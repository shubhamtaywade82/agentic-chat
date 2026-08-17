import type {
  AgentConfig,
  AnswerStep,
  ObservationStep,
  PlanStep,
  ThinkingStep,
  ToolCallStep,
  TraceStep,
} from "./agent-types"
import { DEFAULT_SYSTEM_PROMPT } from "./agent-types"

let idCounter = 0
export const uid = (prefix = "step") => `${prefix}_${Date.now()}_${idCounter++}`

// A scenario describes the full scripted ReAct trace for a given query.
export interface Scenario {
  match: (query: string) => boolean
  build: (query: string, config: AgentConfig) => ScriptedStep[]
}

export type ScriptedStep =
  | { type: "plan"; delay: number; goal: string; steps: string[] }
  | { type: "thinking"; delay: number; title: string; reasoning: string; tokensIn?: number; tokensOut?: number }
  | { type: "tool_call"; delay: number; toolName: string; description: string; args: Record<string, unknown> }
  | { type: "observation"; delay: number; source: string; summary: string; data: unknown }
  | { type: "answer"; delay: number; content: string }

const toolEnabled = (config: AgentConfig, name: string) => config.enabledTools[name] !== false

const weatherScenario: Scenario = {
  match: (q) => /weather|temperature|forecast|rain|sunny/i.test(q),
  build: (q, config) => {
    const city = (q.match(/in ([A-Z][a-zA-Z\s,]+)/)?.[1] || "San Francisco").trim()
    const hasWeather = toolEnabled(config, "weather_api")

    if (!hasWeather) {
      // tool disabled — agent reasons and answers from general knowledge
      return [
        {
          type: "thinking",
          delay: 700,
          title: "Checking available tools",
          reasoning: `The user wants the weather in **${city}**, but the \`weather_api\` tool is **disabled** in this configuration. I cannot fetch live conditions. I'll be honest about this and give a general, non-authoritative answer instead of guessing specifics.`,
          tokensIn: 48,
          tokensOut: 60,
        },
        {
          type: "answer",
          delay: 500,
          content: `I'd love to give you the live weather in ${city}, but the **weather_api** tool is currently disabled in my configuration, so I can't pull real conditions. 🌦️\n\nTo get actual temperatures and a forecast, **enable the \`weather_api\` tool** in the sidebar config and ask again. I won't make up specific numbers I can't verify.`,
        },
      ]
    }

    return [
      {
        type: "plan",
        delay: 500,
        goal: `Answer the user's question about weather in ${city}.`,
        steps: [
          `Parse location from the query`,
          `Call weather_api for current conditions`,
          `Reason about whether the answer is sufficient`,
          `Compose a concise final answer`,
        ],
      },
      {
        type: "thinking",
        delay: 900,
        title: "Parsing the request",
        reasoning: `The user is asking about the weather. I need to identify the location they care about. Scanning the query: "${q}". I detected the location **${city}**. Next I should fetch current conditions via the weather_api tool.`,
        tokensIn: 42,
        tokensOut: 78,
      },
      {
        type: "tool_call",
        delay: 700,
        toolName: "weather_api",
        description: `Fetch current weather for ${city}`,
        args: { location: city, units: "metric" },
      },
      {
        type: "observation",
        delay: 1100,
        source: "weather_api",
        summary: `Current conditions for ${city}`,
        data: {
          location: city,
          temperature_c: 18,
          temperature_f: 64,
          condition: "Partly cloudy",
          humidity: 62,
          wind_kph: 14,
          forecast: [
            { day: "Today", high: 21, low: 14, condition: "Partly cloudy" },
            { day: "Tomorrow", high: 19, low: 13, condition: "Light rain" },
            { day: "Wed", high: 22, low: 15, condition: "Sunny" },
          ],
        },
      },
      {
        type: "thinking",
        delay: 850,
        title: "Evaluating the observation",
        reasoning: `The weather_api returned current conditions plus a 3-day forecast. The observation is sufficient to answer. I notice tomorrow has light rain — worth mentioning so the user can plan. I'll compose a friendly, concise answer with the key numbers.`,
        tokensIn: 96,
        tokensOut: 64,
      },
      {
        type: "answer",
        delay: 600,
        content: `It's currently **18°C (64°F)** and **partly cloudy** in ${city} 🌤️\n\nHere's the next few days:\n\n| Day | High | Low | Condition |\n|---|---|---|---|\n| Today | 21° | 14° | Partly cloudy |\n| Tomorrow | 19° | 13° | ☔ Light rain |\n| Wed | 22° | 15° | ☀️ Sunny |\n\nHeads up — you might want an umbrella tomorrow!`,
      },
    ]
  },
}

const mathScenario: Scenario = {
  match: (q) => /calculate|compute|\d+\s*[\+\-\*\/x^]\s*\d+|how much is|sqrt|square root|percentage/i.test(q),
  build: (q, config) => {
    const expr = q.match(/[\d\.\s\+\-\*\/x^()]+/)?.[0]?.trim() || "2 + 2"
    const hasCalc = toolEnabled(config, "calculator")
    if (!hasCalc) {
      return [
        {
          type: "thinking",
          delay: 700,
          title: "Calculator tool is disabled",
          reasoning: `The expression \`${expr}\` needs evaluation, but the \`calculator\` tool is disabled. I'll attempt the arithmetic mentally and flag that this is unverified, recommending the tool be re-enabled for anything non-trivial.`,
          tokensIn: 36,
          tokensOut: 50,
        },
        {
          type: "answer",
          delay: 400,
          content: `I can't run the \`calculator\` tool right now (it's disabled in config), so this is a **mental estimate, not verified**:\n\n\`${expr}\` ≈ a plausible result depending on operator precedence.\n\nFor an exact answer, re-enable the **calculator** tool in the sidebar and ask again.`,
        },
      ]
    }
    return [
      {
        type: "plan",
        delay: 450,
        goal: "Solve the mathematical expression reliably.",
        steps: [
          `Extract the expression from the query`,
          `Validate it's safe to evaluate`,
          `Run it through the calculator tool`,
          `Double-check the result`,
          `Return the answer`,
        ],
      },
      {
        type: "thinking",
        delay: 700,
        title: "Extracting the expression",
        reasoning: `Looking at the user message, the relevant numeric expression appears to be \`${expr}\`. I'll normalize it (replace \`x\` with \`*\`) and hand it to the calculator tool, which evaluates safely without eval().`,
        tokensIn: 38,
        tokensOut: 52,
      },
      {
        type: "tool_call",
        delay: 550,
        toolName: "calculator",
        description: "Evaluate the arithmetic expression",
        args: { expression: expr },
      },
      {
        type: "observation",
        delay: 900,
        source: "calculator",
        summary: "Numeric result",
        data: { expression: expr, result: 16 },
      },
      {
        type: "thinking",
        delay: 600,
        title: "Verifying the result",
        reasoning: `The calculator returned \`16\`. Sanity check: this looks plausible for the given expression. The result is consistent and I'm confident enough to return it.`,
        tokensIn: 24,
        tokensOut: 30,
      },
      {
        type: "answer",
        delay: 400,
        content: `The result of \`${expr}\` is **16** ✅`,
      },
    ]
  },
}

const codeScenario: Scenario = {
  match: (q) => /code|python|function|script|program|debug|algorithm|fibonacci|sort|write a/i.test(q),
  build: (q, config) => {
    const hasExec = toolEnabled(config, "code_interpreter")
    return [
      {
        type: "plan",
        delay: 500,
        goal: "Write and verify code that solves the user's request.",
        steps: hasExec
          ? [
              `Understand the requirement`,
              `Draft a solution`,
              `Run it in the code interpreter`,
              `Inspect output and iterate if needed`,
              `Present the final code with explanation`,
            ]
          : [
              `Understand the requirement`,
              `Draft a solution`,
              `Present the code (interpreter disabled — cannot verify)`,
            ],
      },
      {
        type: "thinking",
        delay: 1000,
        title: "Understanding the requirement",
        reasoning: `The user wants help with code: "${q}". I'll write a clean, idiomatic Python function${
          hasExec ? " and then actually execute it with the code_interpreter tool to prove it works" : ". The code_interpreter is disabled, so I'll present it without running it and flag that it's unverified"
        } before presenting it.`,
        tokensIn: 64,
        tokensOut: 110,
      },
      ...(hasExec
        ? ([
            {
              type: "tool_call",
              delay: 650,
              toolName: "code_interpreter",
              description: "Run a Python snippet to compute Fibonacci numbers",
              args: {
                language: "python",
                code: "def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\nprint([fib(i) for i in range(10)])",
              },
            },
            {
              type: "observation",
              delay: 1300,
              source: "code_interpreter",
              summary: "stdout from the Python sandbox",
              data: { exit_code: 0, stdout: "[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]", stderr: "" },
            },
          ] as ScriptedStep[])
        : []),
      {
        type: "thinking",
        delay: 750,
        title: hasExec ? "Reflecting on the output" : "Presenting without verification",
        reasoning: hasExec
          ? `The interpreter printed \`[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\` — the first 10 Fibonacci numbers, which is correct. The function is clean and O(n). I'll present it with a short explanation.`
          : `I cannot execute the code because the code_interpreter tool is disabled. I'll present the solution with a clear caveat that it hasn't been run, and recommend re-enabling the interpreter to verify.`,
        tokensIn: hasExec ? 88 : 60,
        tokensOut: hasExec ? 70 : 50,
      },
      {
        type: "answer",
        delay: 500,
        content: hasExec
          ? `Here's a clean iterative implementation that runs in **O(n)** time and **O(1)** space:\n\n\`\`\`python\ndef fib(n: int) -> int:\n    \"\"\"Return the n-th Fibonacci number (0-indexed).\"\"\"\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\n# Example\nprint([fib(i) for i in range(10)])\n# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\n\`\`\`\n\nI verified it by running it in the sandbox — the output matches expectations. ✅`
          : `Here's a clean iterative implementation (⚠️ **not executed** — the \`code_interpreter\` tool is disabled):\n\n\`\`\`python\ndef fib(n: int) -> int:\n    \"\"\"Return the n-th Fibonacci number (0-indexed).\"\"\"\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\`\`\`\n\nTo verify the output, **enable the code_interpreter tool** in the sidebar config and ask again.`,
      },
    ]
  },
}

const researchScenario: Scenario = {
  match: (q) => /research|compare|latest|news|find|explain|what is|how does|summarize/i.test(q),
  build: (q, config) => {
    const hasWeb = toolEnabled(config, "web_search")
    const hasKb = toolEnabled(config, "knowledge_base")

    const planSteps = [`Decompose the question into sub-queries`]
    if (hasWeb) planSteps.push(`Search the web for authoritative sources`)
    if (hasKb) planSteps.push(`Cross-reference with the knowledge base`)
    planSteps.push(`Synthesize findings`, `Cite sources in the answer`)

    const steps: ScriptedStep[] = [
      {
        type: "plan",
        delay: 480,
        goal: "Research and synthesize an answer to the user's question.",
        steps: planSteps,
      },
      {
        type: "thinking",
        delay: 950,
        title: "Decomposing the question",
        reasoning: `The user asked: "${q}". To answer well I should break this into sub-questions and gather evidence${
          hasWeb ? " from the web" : ""
        }${hasWeb && hasKb ? " and " : ""}${hasKb ? "from the knowledge base" : ""}.${
          !hasWeb && !hasKb ? " No research tools are enabled, so I'll answer from my own parametric knowledge with a clear caveat." : ""
        }`,
        tokensIn: 70,
        tokensOut: 95,
      },
    ]

    if (hasWeb) {
      steps.push({
        type: "tool_call",
        delay: 700,
        toolName: "web_search",
        description: "Search the web for relevant sources",
        args: { query: q, num_results: 5 },
      })
      steps.push({
        type: "observation",
        delay: 1400,
        source: "web_search",
        summary: "3 results returned",
        data: {
          results: [
            { title: "Comprehensive guide to the topic", url: "https://example.com/guide", snippet: "An in-depth overview covering fundamentals and advanced concepts." },
            { title: "Recent developments (2024)", url: "https://example.com/news", snippet: "The latest updates and community discussion." },
            { title: "Authoritative reference", url: "https://example.com/ref", snippet: "Peer-reviewed reference documentation." },
          ],
          total: 3,
        },
      })
    }

    if (hasKb) {
      steps.push({
        type: "thinking",
        delay: 800,
        title: "Corroborating findings",
        reasoning: hasWeb
          ? `The web search surfaced high-quality sources. I want to make sure I'm not missing established background, so I'll query the knowledge base for canonical information before synthesizing.`
          : `I'll query the knowledge base for canonical information to ground my answer.`,
        tokensIn: 60,
        tokensOut: 48,
      })
      steps.push({
        type: "tool_call",
        delay: 600,
        toolName: "knowledge_base",
        description: "Look up canonical background information",
        args: { query: q, top_k: 3 },
      })
      steps.push({
        type: "observation",
        delay: 1000,
        source: "knowledge_base",
        summary: "3 relevant documents retrieved",
        data: {
          documents: [
            { id: "kb_0182", score: 0.91, excerpt: "Established definition and historical context." },
            { id: "kb_0455", score: 0.84, excerpt: "Key mechanisms explained with diagrams." },
            { id: "kb_0917", score: 0.77, excerpt: "Common pitfalls and best practices." },
          ],
        },
      })
    }

    if (!hasWeb && !hasKb) {
      steps.push({
        type: "thinking",
        delay: 700,
        title: "No research tools available",
        reasoning: `Both \`web_search\` and \`knowledge_base\` are disabled. I'll synthesize the best answer I can from my own training and clearly flag that it isn't backed by live sources.`,
        tokensIn: 40,
        tokensOut: 55,
      })
    } else {
      steps.push({
        type: "thinking",
        delay: 900,
        title: "Synthesizing the answer",
        reasoning: `I now have ${
          hasWeb && hasKb ? "web sources + knowledge base context. The information is consistent across sources" : hasWeb ? "web sources" : "knowledge base context"
        }, so I'm confident. I'll write a structured answer that explains the concept, gives the key facts, and cites where the information came from.`,
        tokensIn: 142,
        tokensOut: 180,
      })
    }

    steps.push({
      type: "answer",
      delay: 700,
      content:
        hasWeb || hasKb
          ? `Here's a synthesized answer based on ${hasWeb ? "**3 web sources**" : ""}${hasWeb && hasKb ? " and " : ""}${hasKb ? "**3 knowledge-base documents**" : ""}:\n\n## Summary\nThe topic can be understood as a combination of a core concept and its practical implications. The fundamentals are well-established, while recent developments have refined the best practices.\n\n## Key points\n- **Fundamentals** are documented across multiple authoritative sources.\n- **Recent developments** (2024) emphasize updated best practices.\n- **Common pitfalls** are well-known and avoidable with care.\n\n${
              hasWeb
                ? "## Sources\n1. [Comprehensive guide](https://example.com/guide)\n2. [Recent developments](https://example.com/news)\n3. [Authoritative reference](https://example.com/ref)\n\n"
                : ""
            }Would you like me to go deeper on any specific aspect?`
          : `⚠️ **No research tools enabled** — this answer comes from my own parametric knowledge without live sources.\n\n## Summary\nThe topic can be understood as a combination of a core concept and its practical implications. The fundamentals are well-established, while recent developments have refined the best practices.\n\n## Key points\n- **Fundamentals** are documented across multiple authoritative sources.\n- **Recent developments** (2024) emphasize updated best practices.\n- **Common pitfalls** are well-known and avoidable with care.\n\nTo get a sourced answer, enable **web_search** or **knowledge_base** in the sidebar config.`,
    })

    return steps
  },
}

const fallbackScenario: Scenario = {
  match: () => true,
  build: (q) => [
    {
      type: "thinking",
      delay: 600,
      title: "Interpreting the request",
      reasoning: `The user said: "${q}". This doesn't map to a specific tool, so I'll reason directly and compose a thoughtful response. I'll consider what the user most likely wants and structure my answer clearly.`,
      tokensIn: 30,
      tokensOut: 60,
    },
    {
      type: "thinking",
      delay: 700,
      title: "Formulating the response",
      reasoning: `I have enough context to answer without external tools. I'll be concise, friendly, and offer to elaborate if useful.`,
      tokensIn: 20,
      tokensOut: 40,
    },
    {
      type: "answer",
      delay: 500,
      content: `I've thought through your message: *"${q}"*.\n\nThis is a demo of the **agentic ReAct loop** — you can see my thinking steps above. Try asking me about the **weather**, a **math calculation**, **writing code**, or ask me to **research** something, and you'll see me call different tools and observe their results before composing a final answer.`,
    },
  ],
}

const SCENARIOS: Scenario[] = [weatherScenario, mathScenario, codeScenario, researchScenario, fallbackScenario]

export function pickScenario(query: string): Scenario {
  return SCENARIOS.find((s) => s.match(query)) ?? fallbackScenario
}

export function buildScript(query: string, config: AgentConfig): ScriptedStep[] {
  const raw = pickScenario(query).build(query, config)

  // ---- Cap iterations ----
  // Count "thinking" steps as iteration markers. If the trace would exceed
  // maxIterations reasoning cycles, truncate and append a cap notice + a
  // synthesized answer so the agent still responds.
  const maxIters = config.maxIterations
  let iterSeen = 0
  let cutIndex = raw.length
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].type === "thinking") {
      iterSeen += 1
      if (iterSeen > maxIters) {
        cutIndex = i
        break
      }
    }
  }

  if (cutIndex < raw.length) {
    const head = raw.slice(0, cutIndex)
    const capNotice: ScriptedStep = {
      type: "thinking",
      delay: 400,
      title: `Max iterations (${maxIters}) reached`,
      reasoning: `I've hit the configured iteration cap of **${maxIters}** reasoning cycles without producing a final answer. Per my operating constraints I'll stop the loop and synthesize the best answer I can from what I've gathered so far. Consider raising \`maxIterations\` in the config for harder tasks.`,
      tokensIn: 30,
      tokensOut: 55,
    }
    const truncatedAnswer: ScriptedStep = {
      type: "answer",
      delay: 500,
      content: `_Stopped early after reaching the **${maxIters}-iteration** cap._\n\nBased on what I gathered before the loop was cut off, here's the best answer I can give right now. For a more thorough result, **increase max iterations** in the sidebar configuration and retry.`,
    }
    return [...head, capNotice, truncatedAnswer]
  }

  return raw
}

// Convert a scripted step into a real TraceStep with ids & timing.
export function realizeStep(scripted: ScriptedStep, iteration: number): TraceStep {
  const base = {
    id: uid(),
    status: "running" as const,
    iteration,
    startedAt: Date.now(),
  }
  switch (scripted.type) {
    case "plan":
      return {
        ...base,
        kind: "plan",
        goal: scripted.goal,
        steps: scripted.steps.map((text, i) => ({ id: `sub_${i}`, text, done: false })),
      } as PlanStep
    case "thinking":
      return {
        ...base,
        kind: "thinking",
        title: scripted.title,
        reasoning: scripted.reasoning,
        tokensIn: scripted.tokensIn,
        tokensOut: scripted.tokensOut,
      } as ThinkingStep
    case "tool_call":
      return {
        ...base,
        kind: "tool_call",
        toolName: scripted.toolName,
        description: scripted.description,
        args: scripted.args,
      } as ToolCallStep
    case "observation":
      return {
        ...base,
        kind: "observation",
        source: scripted.source,
        summary: scripted.summary,
        data: scripted.data,
      } as ObservationStep
    case "answer":
      return {
        ...base,
        kind: "answer",
        content: scripted.content,
      } as AnswerStep
  }
}

// Convenience used by the store when seeding config defaults.
export { DEFAULT_SYSTEM_PROMPT }
