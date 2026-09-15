import { NextRequest } from "next/server"
import { executeLiveTool, getToolSystemPrompt } from "@/lib/live-tools"
import { formatMemoriesForPrompt } from "@/lib/memory-engine"
import { DEFAULT_PROVIDER_URLS, type AgentConfig, type CustomTool } from "@/lib/agent-types"
import { McpClientManager } from "@/lib/mcp/client"
import { isMcpToolName } from "@/lib/mcp/types"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

const KNOWN_PREFIXES = ["binance_", "futures_", "dhan_", "prop_", "mcp_"]
const KNOWN_EXACT = ["calculator", "weather_api", "weather", "web_search", "search", "code_interpreter"]

const TOOL_ALIASES: Record<string, string> = {
  propscan: "prop_scan_setups",
  propscansetups: "prop_scan_setups",
  scan_setups: "prop_scan_setups",
  scansetups: "prop_scan_setups",
  scansetup: "prop_scan_setups",
  propeval: "prop_evaluate_pair",
  propevaluatepair: "prop_evaluate_pair",
  evaluatesetup: "prop_evaluate_pair",
  eval_pair: "prop_evaluate_pair",
  proprisk: "prop_risk_calculator",
  propriskcalculator: "prop_risk_calculator",
  riskcalc: "prop_risk_calculator",
  positionsize: "prop_risk_calculator",
  binance_price: "binance_price",
  binanceprice: "binance_price",
  price: "binance_price",
  binance: "binance_price",
  ticker: "binance_24hr_ticker",
  binance_ticker: "binance_24hr_ticker",
  stats: "binance_24hr_ticker",
  kline: "binance_klines",
  klines: "binance_klines",
  candle: "binance_klines",
  candles: "binance_klines",
  orderbook: "binance_order_book",
  order_book: "binance_order_book",
  depth: "binance_order_book",
  funding_rate: "binance_funding_rate",
  funding: "binance_funding_rate",
  open_interest: "binance_open_interest",
  long_short_ratio: "binance_long_short_ratio",
  weather: "weather_api",
  weather_api: "weather_api",
  calc: "calculator",
  calculator: "calculator",
  math: "calculator",
  search: "web_search",
  web_search: "web_search",
  code: "code_interpreter",
  code_interpreter: "code_interpreter",
}

function normalizeToolName(name: string, customTools: CustomTool[] = []): string | null {
  const norm = name.toLowerCase().replace(/[^a-z0-9_]/g, "")
  if (KNOWN_EXACT.includes(norm)) return norm
  if (KNOWN_PREFIXES.some((p) => norm.startsWith(p))) return norm
  const matchedCustom = customTools.find((c) => c.name.toLowerCase() === norm)
  if (matchedCustom) return matchedCustom.name
  return TOOL_ALIASES[norm] || null
}

function inferToolFromContext(text: string, args: Record<string, unknown>, customTools: CustomTool[] = []): string | null {
  for (const c of customTools) {
    if (new RegExp(`\\b${c.name}\\b`, "i").test(text)) return c.name
  }
  const known = [
    "prop_scan_setups", "prop_evaluate_pair", "prop_risk_calculator",
    "binance_price", "binance_24hr_ticker", "binance_klines", "binance_order_book",
    "binance_funding_rate", "binance_open_interest", "binance_long_short_ratio",
    "dhan_market_summary", "dhan_ltp", "dhan_quote", "dhan_holdings", "dhan_positions", "dhan_funds",
    "calculator", "weather_api", "web_search", "code_interpreter"
  ]
  for (const k of known) {
    if (new RegExp(`\\b${k}\\b`, "i").test(text)) return k
  }
  if (args.symbol || args.ticker) return "binance_price"
  if (args.underlyingSymbol) return "dhan_market_summary"
  if (args.securityId) return "dhan_ltp"
  if (args.location || args.city) return "weather_api"
  if (args.expression) return "calculator"
  if (args.query) return "web_search"
  if (args.code) return "code_interpreter"
  return null
}

function buildToolArgs(toolName: string, val: string): Record<string, unknown> {
  if (toolName.includes("binance")) return { symbol: val }
  if (toolName.includes("dhan_market_summary")) return { underlyingSymbol: val }
  if (toolName.includes("dhan")) return { securityId: val }
  if (toolName.includes("weather")) return { location: val }
  if (toolName.includes("calc")) return { expression: val }
  if (toolName.includes("search")) return { query: val }
  if (toolName.includes("code")) return { code: val }
  return { input: val }
}

// Prune history to prevent exceeding model context window while retaining system prompt and latest user query
function pruneConversation(messages: ChatMessage[], maxChars = 14000): ChatMessage[] {
  if (messages.length <= 2) return messages
  const system = messages[0]?.role === "system" ? messages[0] : null
  const latestUser = messages[messages.length - 1]
  const history = messages.slice(system ? 1 : 0, -1)

  let totalChars = (system?.content.length || 0) + (latestUser?.content.length || 0)
  const kept: ChatMessage[] = []

  for (let i = history.length - 1; i >= 0; i--) {
    const len = history[i].content.length
    if (totalChars + len > maxChars) break
    totalChars += len
    kept.unshift(history[i])
  }

  return system ? [system, ...kept, latestUser] : [...kept, latestUser]
}

// Call LLM endpoint (Ollama, OpenAI, Groq, Custom) using chat completions protocol
async function callLlm(
  messages: ChatMessage[],
  config: AgentConfig
): Promise<{ text: string; tokensIn?: number; tokensOut?: number }> {
  const provider = config.provider
  let baseUrl = config.apiBaseUrl || DEFAULT_PROVIDER_URLS[provider] || "http://localhost:11434"
  if (provider === "ollama_cloud" && baseUrl.includes("api.ollama.com")) {
    baseUrl = baseUrl.replace("api.ollama.com", "ollama.com")
  }
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

  const payload: Record<string, unknown> = {
    model: config.modelId,
    messages: pruneConversation(messages),
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  }

  // Set num_ctx to prevent local Ollama from defaulting to 4096 tokens and erroring out
  if (provider === "ollama_local" || provider === "ollama_cloud") {
    payload.options = {
      num_ctx: 16384,
    }
  }

  const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    if (res.status === 401) {
      throw new Error(
        `LLM provider (${provider}) returned 401 Unauthorized. Remote cloud providers require an API key — please add your key in Agent Settings (⚙️), or switch to 'Ollama (Local)' to run locally with zero API keys.`
      )
    }
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
  // 1. JSON object directly in Action line (e.g. Action: {"tool": "binance_price", "symbol": "SOLUSDT"} or Action: {"symbol": "SOLUSDT"})
  const jsonActionMatch = text.match(/(?:Action|Tool|Tool Call):\s*(\{[\s\S]*?\})/i) || text.match(/(?:Action|Tool|Tool Call):\s*```(?:json)?\s*(\{[\s\S]*?\})\s*```/i)
  if (jsonActionMatch) {
    try {
      const obj = JSON.parse(jsonActionMatch[1])
      let toolName = obj.tool || obj.name || obj.action || obj.tool_name || ""
      const { tool: _t, name: _n, action: _a, tool_name: _tn, ...rest } = obj
      const rawArgs = Object.keys(rest).length > 0 ? (rest.args || rest.parameters || rest.input || rest) : {}
      const args = typeof rawArgs === "object" && rawArgs !== null ? rawArgs : { input: rawArgs }

      if (!toolName) {
        toolName = inferToolFromContext(text, args, customTools) || ""
      }

      const normalized = normalizeToolName(toolName, customTools)
      if (normalized) {
        return { toolName: normalized, args }
      }
    } catch {
      // Continue to next parser
    }
  }

  // 2. Standard or function syntax (e.g. Action: binance_price({"symbol": "SOLUSDT"}) or Action: binance_price)
  const stdMatch = text.match(/(?:Action|Tool|Tool Call):\s*[`\[]?([a-zA-Z0-9_\-]+)[`\]]?(?:[\s\(]+(\{[\s\S]*?\})[\)]?)?/i)
  if (stdMatch) {
    const rawTool = stdMatch[1].trim()
    const normalized = normalizeToolName(rawTool, customTools)
    if (normalized) {
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
            args = typeof parsed === "object" && parsed !== null ? parsed : { input: parsed }
          } catch {
            args = { input: raw.replace(/^["'`]|["'`]$/g, "") }
          }
        }
      }
      return { toolName: normalized, args }
    }
  }

  // Do not perform fuzzy natural language matching on finished answers or structured tables
  if (/Final Answer:/i.test(text) || text.includes("|") || text.length > 400) {
    return null
  }

  // 3. Fallback for explicit tool execution intents in thoughts with arguments
  const natMatch = text.match(/\b(?:call|calling|fetch|fetching|run|execute)\s+(?:the\s+)?([a-zA-Z0-9_\-]+)(?:[\s\S]*?(?:symbol|ticker|underlyingSymbol|query|location|code|securityId|expression)["\s:=]+([a-zA-Z0-9_\.\-]+))?/i)
  if (natMatch) {
    const rawTool = natMatch[1].toLowerCase().replace(/[^a-z0-9_]/g, "")
    const normalized = normalizeToolName(rawTool, customTools)
    const val = natMatch[2]?.replace(/^["'`]|["'`]$/g, "")
    if (normalized && val) {
      return { toolName: normalized, args: buildToolArgs(normalized, val) }
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
  const { query, history = [], config, customTools = [] } = (await req.json()) as {
    query: string
    history?: { role: "user" | "assistant"; content: string }[]
    config: AgentConfig
    customTools?: CustomTool[]
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // ── MCP server bootstrap ────────────────────────────────────────────
      // Spawn/connect to all enabled MCP servers up front so their tools
      // are available to the LLM on the very first iteration. Failures are
      // non-fatal: a single broken server is logged and skipped, the rest
      // of the agent loop proceeds normally.
      const mcpManager = new McpClientManager()
      let mcpTools: Awaited<ReturnType<typeof mcpManager.connectAll>>["tools"] = []
      const mcpErrors: { serverName: string; error: string }[] = []
      try {
        const mcpResult = await mcpManager.connectAll(config.mcpServers || [])
        mcpTools = mcpResult.tools
        for (const err of mcpResult.errors) {
          mcpErrors.push({ serverName: err.serverName, error: err.error })
        }
      } catch (err) {
        // connectAll already handles per-server failures; this catches
        // unexpected total failures (e.g. SDK init error).
        const msg = err instanceof Error ? err.message : String(err)
        mcpErrors.push({ serverName: "(all)", error: msg })
      }

      try {
        const memoryBlock = formatMemoriesForPrompt(config.memories, query)
        const systemPrompt = `${config.systemPrompt}${memoryBlock}\n\n${getToolSystemPrompt(config.enabledTools, customTools, mcpTools)}`
        const conversation: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: query },
        ]

        let currentIteration = 1
        const maxIters = config.maxIterations || 10
        let finalAnswerFound = false
        let planDetected = false
        let planRequiresTool = false
        let toolCallMade = false

        while (currentIteration <= maxIters && !finalAnswerFound) {
          const llmRes = await callLlm(conversation, config)
          const content = llmRes.text

          // Step 1: Detect and emit Plan if in first iteration
          if (currentIteration === 1) {
            const planSteps = parsePlan(content)
            if (planSteps) {
              planDetected = true
              planRequiresTool = planSteps.some((step) => {
                const s = step.toLowerCase()
                return (
                  Object.keys(config.enabledTools || {}).some((t) => config.enabledTools[t] && s.includes(t.toLowerCase())) ||
                  customTools.some((t) => s.includes(t.name.toLowerCase())) ||
                  mcpTools.some((m) => s.includes(m.fullName.toLowerCase())) ||
                  /\b(fetch|call tool|use tool|execute tool|lookup live|live data|order book)\b/i.test(s)
                )
              })
              send({
                kind: "plan",
                iteration: currentIteration,
                goal: `Resolve request: "${query}"`,
                steps: planSteps.map((text, i) => ({ id: `step_${i + 1}`, text, done: false })),
              })
            }
          }

          // Step 2: Check for Action, and extract reasoning/thought
          const action = parseAction(content, customTools)
          const thoughtMatch = content.match(/Thought:\s*([\s\S]*?)(?=Action:|Final Answer:|$)/i)
          const hasFinalAnswerLabel = /Final Answer:/i.test(content)
          // Only synthesize a thought from the raw content when the model actually left something
          // preceding an Action or Final Answer — otherwise content IS the final answer, and showing
          // it again as "thinking" just duplicates the same text in two bubbles.
          const thoughtText = thoughtMatch
            ? thoughtMatch[1].trim()
            : action || hasFinalAnswerLabel
              ? content.replace(/Final Answer:[\s\S]*/i, "").trim()
              : ""

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

          if (action) {
            send({
              kind: "tool_call",
              iteration: currentIteration,
              toolName: action.toolName,
              description: `Calling ${action.toolName} with parameters`,
              args: action.args,
            })

            toolCallMade = true

            // Route to MCP manager if the tool name uses the mcp__ prefix,
            // otherwise dispatch to the built-in live-tools.
            const toolResult = isMcpToolName(action.toolName)
              ? await mcpManager.callTool(action.toolName, action.args)
              : await executeLiveTool(action.toolName, action.args, customTools, config.dhan, config.binance)

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
            const hasSubstantialAnswer =
              finalAnswer.length > 80 || /\n(?:```|[#*-]|<table|\|)/.test(finalAnswer)
            const isOnlyPlanOrThought =
              !finalAnswer ||
              (!hasSubstantialAnswer &&
                (content.trim().startsWith("Plan:") || content.trim().startsWith("Thought:")) &&
                !/Final Answer:/i.test(content))
            // Only consider an answer premature if the plan explicitly intended to fetch external tool data
            const answerPrematureVsPlan = planRequiresTool && !toolCallMade

            if ((isOnlyPlanOrThought || answerPrematureVsPlan) && currentIteration < maxIters) {
              conversation.push({ role: "assistant", content })
              conversation.push({
                role: "user",
                content: answerPrematureVsPlan
                  ? "Your plan requires live data you haven't fetched yet. Emit an Action to call the needed tool now — do not give a Final Answer until you have real tool observations to base it on."
                  : "Observation reviewed. Please present your complete Final Answer in rich Markdown to the user.",
              })
              currentIteration += 1
            } else {
              send({
                kind: "answer",
                iteration: currentIteration,
                content: finalAnswer || content || "The model returned an empty response after multiple attempts. Try again or switch models.",
              })
              finalAnswerFound = true
            }
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
      } finally {
        // Always close MCP server child processes / HTTP connections, even
        // if the loop threw. Without this, spawned stdio servers would leak
        // as orphan processes until the Next.js process exits.
        await mcpManager.closeAll().catch(() => {})
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
