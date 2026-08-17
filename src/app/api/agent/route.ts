import { NextRequest } from "next/server"
import { executeLiveTool, getToolSystemPrompt } from "@/lib/live-tools"
import { DEFAULT_PROVIDER_URLS, type AgentConfig, type CustomTool } from "@/lib/agent-types"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

const KNOWN_PREFIXES = ["binance_", "futures_", "dhan_"]
const KNOWN_EXACT = ["calculator", "weather_api", "weather", "web_search", "search", "code_interpreter"]

function isKnownTool(name: string, customTools: CustomTool[] = []): boolean {
  const norm = name.toLowerCase().replace(/[^a-z0-9_]/g, "")
  if (KNOWN_EXACT.includes(norm)) return true
  if (KNOWN_PREFIXES.some((p) => norm.startsWith(p))) return true
  if (customTools.some((c) => c.name.toLowerCase() === norm)) return true
  return false
}

// Call LLM endpoint (Ollama, OpenAI, Groq, Custom) using chat completions protocol
async function callLlm(
  messages: ChatMessage[],
  config: AgentConfig
): Promise<{ text: string; tokensIn?: number; tokensOut?: number }> {
  const provider = config.provider
  let baseUrl = config.apiBaseUrl || DEFAULT_PROVIDER_URLS[provider] || "http://localhost:11434"
  if (provider === "ollama_local" || provider === "ollama_cloud") {
    if (!baseUrl.includes("/v1")) {
      baseUrl = `${baseUrl.replace(/\/$/, "")}/v1`
    }
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`
  }

  const payload = {
    model: config.modelId,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  }

  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`LLM provider (${provider}) returned status ${res.status}: ${errText.slice(0, 180)}`)
  }

  const json = await res.json()
  const text = json.choices?.[0]?.message?.content || ""
  const tokensIn = json.usage?.prompt_tokens
  const tokensOut = json.usage?.completion_tokens
  return { text, tokensIn, tokensOut }
}

// Parses tool call action and action input from various LLM response formats
function parseAction(text: string, customTools: CustomTool[] = []): { toolName: string; args: Record<string, unknown> } | null {
  // 1. JSON object directly in Action line (e.g. Action: {"tool": "dhan_market_summary", ...})
  const jsonActionMatch = text.match(/Action:\s*(\{[\s\S]*?\})/i) || text.match(/Action:\s*```(?:json)?\s*(\{[\s\S]*?\})\s*```/i)
  if (jsonActionMatch) {
    try {
      const obj = JSON.parse(jsonActionMatch[1])
      const toolName = obj.tool || obj.name || obj.action || obj.tool_name || ""
      if (toolName && isKnownTool(toolName, customTools)) {
        const { tool: _t, name: _n, action: _a, tool_name: _tn, ...rest } = obj
        const args = Object.keys(rest).length > 0 ? (rest.args || rest.parameters || rest.input || rest) : {}
        return { toolName, args: typeof args === "object" && args !== null ? args : { input: args } }
      }
    } catch {
      // Continue to next parser
    }
  }

  // 2. Standard or function syntax (e.g. Action: dhan_ltp({"securityId": "1333"}) or Action: dhan_ltp)
  const stdMatch = text.match(/Action:\s*[`\[]?([a-zA-Z0-9_\-]+)[`\]]?(?:[\s\(]+(\{[\s\S]*?\})[\)]?)?/i)
  if (stdMatch) {
    const rawTool = stdMatch[1].trim()
    if (isKnownTool(rawTool, customTools)) {
      let args: Record<string, unknown> = {}
      if (stdMatch[2]) {
        try {
          args = JSON.parse(stdMatch[2])
        } catch {
          args = { input: stdMatch[2].replace(/^["'`]|["'`]$/g, "") }
        }
      } else {
        const inputMatch = text.match(/Action Input:\s*(\{[\s\S]*?\}|\[[\s\S]*?\]|".*?"|[^\n]+)/i)
        if (inputMatch) {
          const raw = inputMatch[1].trim()
          try {
            const parsed = JSON.parse(raw)
            if (typeof parsed === "string") {
              try {
                args = JSON.parse(parsed)
              } catch {
                args = { input: parsed }
              }
            } else if (typeof parsed === "object" && parsed !== null) {
              args = parsed
            } else {
              args = { input: parsed }
            }
          } catch {
            args = { input: raw.replace(/^["'`]|["'`]$/g, "") }
          }
        }
      }
      return { toolName: rawTool, args: typeof args === "object" && args !== null ? args : { input: args } }
    }
  }

  return null
}

// Parses high-level plan items if present in the LLM text
function parsePlan(text: string): string[] | null {
  const planMatch = text.match(/Plan:\s*([\s\S]*?)(?=Thought:|Action:|$)/i)
  if (!planMatch) return null
  const lines = planMatch[1].split("\n").map((l) => l.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean)
  return lines.length > 0 ? lines : null
}

// Extracts clean final answer preserving rich markdown formatting
function extractFinalAnswer(content: string): string {
  const answerMatch = content.match(/Final Answer:\s*([\s\S]*)$/i)
  if (answerMatch) return answerMatch[1].trim()

  const withoutThought = content.replace(/^Thought:\s*[\s\S]*?(?=\n\n(?:```|[#*-]|<table|\[|{))/i, "").trim()
  if (withoutThought && withoutThought !== content) return withoutThought

  return content.replace(/^Thought:[\s\S]*?(?=\n\s*(?:Final Answer:|$))/i, "").replace(/^Final Answer:\s*/i, "").trim() || content
}

export async function POST(req: NextRequest) {
  const { query, config, customTools = [] } = (await req.json()) as {
    query: string
    config: AgentConfig
    customTools?: CustomTool[]
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const systemPrompt = `${config.systemPrompt}\n\n${getToolSystemPrompt(config.enabledTools, customTools)}`
        const conversation: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ]

        let currentIteration = 1
        const maxIters = config.maxIterations || 6
        let finalAnswerFound = false

        while (currentIteration <= maxIters && !finalAnswerFound) {
          const llmRes = await callLlm(conversation, config)
          const content = llmRes.text

          // Step 1: Detect and emit Plan if in first iteration
          if (currentIteration === 1) {
            const planSteps = parsePlan(content)
            if (planSteps) {
              send({
                kind: "plan",
                iteration: currentIteration,
                goal: `Resolve request: "${query}"`,
                steps: planSteps,
              })
            }
          }

          // Step 2: Extract reasoning/thought
          const thoughtMatch = content.match(/Thought:\s*([\s\S]*?)(?=Action:|Final Answer:|$)/i)
          const thoughtText = thoughtMatch ? thoughtMatch[1].trim() : content.replace(/Final Answer:[\s\S]*/i, "").trim()

          if (thoughtText) {
            send({
              kind: "thinking",
              iteration: currentIteration,
              title: currentIteration === 1 ? "Analyzing user query & plan" : `Iterative reasoning (cycle ${currentIteration})`,
              reasoning: thoughtText,
              tokensIn: llmRes.tokensIn || 40,
              tokensOut: llmRes.tokensOut || 60,
            })
          }

          // Step 3: Check for Action vs Final Answer
          const action = parseAction(content, customTools)

          if (action) {
            send({
              kind: "tool_call",
              iteration: currentIteration,
              toolName: action.toolName,
              description: `Calling ${action.toolName} with parameters`,
              args: action.args,
            })

            const toolResult = await executeLiveTool(action.toolName, action.args, customTools, config.dhan, config.binance)

            send({
              kind: "observation",
              iteration: currentIteration,
              source: action.toolName,
              summary: toolResult.summary,
              data: toolResult.data,
            })

            // Feed observation back into conversation for next iteration
            conversation.push({ role: "assistant", content })
            conversation.push({
              role: "user",
              content: `Observation from ${action.toolName}:\n${JSON.stringify(toolResult.data, null, 2)}\n\nNow review the observation above and produce your next Thought/Action, or give your Final Answer in rich Markdown.`,
            })

            currentIteration += 1
          } else {
            const finalAnswer = extractFinalAnswer(content)
            send({
              kind: "answer",
              iteration: currentIteration,
              content: finalAnswer || content,
            })
            finalAnswerFound = true
          }
        }

        if (!finalAnswerFound) {
          send({
            kind: "answer",
            iteration: currentIteration,
            content: "The agent completed maximum allowed iterations. Please see the trace steps above.",
          })
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        send({
          kind: "answer",
          iteration: 1,
          content: `⚠️ **Agent Error**: ${errorMsg}`,
        })
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
