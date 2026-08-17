import { NextRequest } from "next/server"
import { executeLiveTool, getToolSystemPrompt } from "@/lib/live-tools"
import { DEFAULT_PROVIDER_URLS, type AgentConfig, type CustomTool } from "@/lib/agent-types"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
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

// Parses tool call action and action input from LLM text
function parseAction(text: string): { toolName: string; args: Record<string, unknown> } | null {
  const actionMatch = text.match(/Action:\s*([a-zA-Z0-9_\-]+)/i)
  if (!actionMatch) return null

  const toolName = actionMatch[1].trim()
  let args: Record<string, unknown> = {}

  const inputMatch = text.match(/Action Input:\s*(\{[\s\S]*?\}|\[[\s\S]*?\]|".*?"|[^\n]+)/i)
  if (inputMatch) {
    const rawInput = inputMatch[1].trim()
    try {
      args = JSON.parse(rawInput)
    } catch {
      args = { input: rawInput.replace(/^["']|["']$/g, "") }
    }
  }

  return { toolName, args }
}

// Parses high-level plan items if present in the LLM text
function parsePlan(text: string): string[] | null {
  const planMatch = text.match(/Plan:\s*([\s\S]*?)(?=Thought:|Action:|$)/i)
  if (!planMatch) return null
  const lines = planMatch[1].split("\n").map((l) => l.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean)
  return lines.length > 0 ? lines : null
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
          const action = parseAction(content)
          const answerMatch = content.match(/Final Answer:\s*([\s\S]*)$/i)

          if (action && !answerMatch) {
            send({
              kind: "tool_call",
              iteration: currentIteration,
              toolName: action.toolName,
              description: `Calling ${action.toolName} with parameters`,
              args: action.args,
            })

            const toolResult = await executeLiveTool(action.toolName, action.args, customTools)

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
              content: `Observation from ${action.toolName}:\n${JSON.stringify(toolResult.data, null, 2)}\n\nContinue with your next Thought and Action or provide your Final Answer.`,
            })

            currentIteration += 1
          } else {
            const finalAnswer = answerMatch ? answerMatch[1].trim() : content.replace(/^Thought:[\s\S]*?(?=Final Answer:)/i, "").replace(/^Final Answer:\s*/i, "").trim()
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
            content: `_Reached max configured ReAct iteration limit (${maxIters}). Summarizing findings gathered so far._`,
          })
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        send({
          kind: "answer",
          iteration: 1,
          content: `⚠️ **LLM Execution Error:**\n\n${errorMsg}\n\n*Tip: Check that **${config.provider}** is running and the model **\`${config.modelId}\`** is available.*`,
        })
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
