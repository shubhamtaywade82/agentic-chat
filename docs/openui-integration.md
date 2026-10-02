# OpenUI Integration Plan

> Branch: `feature/openui-integration`
> Author: OpenUI Spike
> Status: **Spike / Proposal** — design only; no production wiring yet.

## 0. TL;DR

[OpenUI](https://github.com/thesysdev/openui) by Thesys is an MIT-licensed
**generative-UI framework** that lets an LLM emit a compact, streamable DSL
("OpenUI Lang") instead of plain text/Markdown. A React `<Renderer>` progressively
parses that DSL into a tree of *your* registered components as tokens arrive,
turning each assistant response into a live, interactive UI (charts, forms,
tables, trading cards, dashboards) rather than a static Markdown block.

Today, `agentic-chat`'s assistant responses are rendered as Markdown via
`react-markdown` (see `src/components/agent-chat/markdown.tsx`). The ReAct loop
(`src/app/api/agent/route.ts`) already speaks the OpenAI Chat Completions
protocol over SSE, so it is **trivially compatible** with OpenUI's Gateway and
self-host adapters.

This doc proposes **four composable integration patterns**, ranked from
smallest to largest blast radius, plus a recommended phased rollout.

---

## 1. What OpenUI actually is

OpenUI is **(d) all of the above** — a framework, a hosted API, and a SaaS
observability product. The pieces that matter for `agentic-chat`:

| Piece | What it is | Why we care |
|---|---|---|
| **`@openuidev/lang-core`** | Framework-agnostic parser + system-prompt generator | Lets us generate a system prompt from a component library on the server, and parse OpenUI Lang on either side |
| **`@openuidev/react-lang`** | React runtime: `defineComponent`, `createLibrary`, `<Renderer>`, streaming parser | The actual UI renderer we'd mount in `agent-message.tsx` |
| **`@openuidev/react-ui`** | Prebuilt `<AgentInterface>`, `fetchLLM`, OpenAI/Vercel/LangGraph/AG-UI adapters, built-in `openuiLibrary` | Optional swap-in for the entire chat surface |
| **OpenUI Gateway** (`api.thesys.dev/v1/embed`) | Hosted OpenAI-compatible endpoint that auto-validates OpenUI Lang mid-stream | Can be added to `LlmProvider` as just another OpenAI-compatible backend |
| **OpenUI Lang** | The DSL itself (token-efficient, ~67% smaller than JSON) | What the model emits instead of Markdown |

**License:** MIT (full self-hosting supported — no vendor lock-in).
**MCP:** First-class — `<Renderer>` accepts a `toolProvider` prop that can be a
function map *or* any `@modelcontextprotocol/sdk` client. We already have a
pooled `McpClientManager`.

### 1.1 What it gives us that we don't have today

1. **Structured, interactive final answers.** A response to "show me BTC
   funding rate and order book" can render a live `<FundingRateChart>` +
   `<OrderBookTable>` instead of a Markdown table.
2. **Token efficiency.** OpenUI Lang is ~67% smaller than JSON-based
   generative-UI formats — directly relevant because we already prune
   conversation history to 14k chars in `agent/route.ts`.
3. **Mid-stream validation.** Gateway auto-corrects malformed OpenUI Lang as
   it streams, so partial renders don't crash the UI.
4. **MCP bridge.** Components can call our existing MCP tools at runtime via
   `Query()` / `Mutation()` statements — a generated form can submit into a
   Dhan order, or a chart can re-query Binance when the user toggles a symbol.

### 1.2 What it does *not* give us

- It is **not** an agent loop / ReAct orchestrator. The ReAct
  (Plan/Thought/Action/Observation) loop stays ours.
- It is **not** a replacement for our tools. `executeLiveTool` and the MCP
  pool remain the source of truth for tool execution.
- It is **not** a free chat UI — `<AgentInterface>` is opinionated (its own
  sidebar, thread list, composer). Swapping it in means rewriting
  `src/components/agent-chat/index.tsx`.

---

## 2. Integration points in `agentic-chat`

| File | Role | OpenUI touch-point |
|---|---|---|
| `src/app/api/agent/route.ts` | SSE ReAct loop, calls `callLlm()` which speaks OpenAI Chat Completions | Already compatible with Gateway; just needs the provider added |
| `src/lib/agent-types.ts` | `LlmProvider` union + `DEFAULT_PROVIDER_URLS` map | Add `openui_gateway` provider |
| `src/app/api/models/route.ts` | Lists models for a provider | Add a small static catalog for the Gateway (or hit `/v1/models`) |
| `src/components/agent-chat/agent-message.tsx` | Renders the trace timeline + final answer | Mount `<Renderer>` for `kind: "answer"` steps when OpenUI is enabled |
| `src/components/agent-chat/markdown.tsx` | Markdown renderer for answer text | Becomes a fallback when the response isn't valid OpenUI Lang |
| `src/lib/mcp/client.ts` + `pool.ts` | Pooled MCP client manager | Can be exposed as an `McpClientLike` for `<Renderer toolProvider>` |
| `src/lib/live-tools.ts` | Built-in tool dispatcher (`executeLiveTool`) | Can be wrapped as a `Record<string, (args)=>Promise<unknown>>` toolProvider |
| `src/store/agent-store.ts` | Zustand store, owns the SSE consumer | Add an `openuiEnabled` config flag; route answer payloads accordingly |

The good news: **the existing ReAct loop and tool layer require zero changes
for Pattern A and B.** OpenUI slots in purely as a presentation upgrade for
the final answer.

---

## 3. The four integration patterns

### Pattern A — OpenUI Gateway as a new LLM provider

**Effort:** ~30 minutes · **Risk:** Very low · **Value:** Lets users opt into
OpenUI Lang generation without any UI changes.

```
User ──▶ /api/agent ──▶ callLlm(provider: "openui_gateway",
                                  baseUrl: "https://api.thesys.dev/v1/embed",
                                  apiKey: THESYS_API_KEY)
                  └──▶ OpenAI-compatible SSE stream of OpenUI Lang
```

`callLlm()` already builds an OpenAI Chat Completions request, so this is
literally three edits:

1. Add `"openui_gateway"` to the `LlmProvider` union in `agent-types.ts`.
2. Add `openui_gateway: "https://api.thesys.dev/v1/embed"` to
   `DEFAULT_PROVIDER_URLS`.
3. Extend the OpenAI branch in `models/route.ts` to also handle
   `openui_gateway`.

The system prompt should additionally carry the OpenUI component spec when
this provider is active — generated server-side via
`generateSystemPrompt({ cloud: true, library })` from `@openuidev/lang-core`.
See spike code in `src/lib/openui/library.ts` and `src/lib/openui/prompt.ts`.

**Pros:** Zero UI changes; the existing ReAct trace UI renders unchanged.
**Cons:** The model emits OpenUI Lang as plain text in the answer bubble —
ugly until Pattern B lands.

---

### Pattern B — Generative-UI renderer for the Final Answer

**Effort:** ~1 day · **Risk:** Low (additive) · **Value:** The big visual
payoff — interactive charts/cards/tables instead of Markdown.

```
/api/agent ──SSE──▶ agent-store ──▶ AgentMessageView
                                       │
                                       └─ kind:"answer" step
                                            ├─ isOpenuiLang(content)?
                                            │    YES ─▶ <OpenUIAnswerRenderer content={content} library={...} />
                                            │    NO  ─▶ <MarkdownView content={content} />   (existing)
                                            └─
```

A new `src/components/agent-chat/openui-answer.tsx` wraps
`<Renderer response={content} library={domainLibrary} isStreaming={running}
toolProvider={...} />`. The detector is a tiny heuristic (starts with
`<Stack` / `<VStack` / contains `@Run` or `Query(`) — cheap, no parser needed.

**Pros:**
- Preserves the entire ReAct trace UI (the project's signature feature).
- Markdown fallback means non-OpenUI providers (Ollama local, Groq, etc.)
  keep working unchanged.
- `toolProvider` can wire both `executeLiveTool` and the pooled MCP manager,
  so generated components can call the same tools the agent uses.

**Cons:**
- Need to author a domain `Library` (Binance cards, order book table, prop
  setup card, etc.). Start with 4–5 components.
- Need to handle streaming partial-parse states (the streaming parser
  already does this; we just wire `isStreaming` correctly).

---

### Pattern C — Replace the chat surface with `<AgentInterface>`

**Effort:** ~3–5 days · **Risk:** High (UI rewrite) · **Value:** Production
chat UX out of the box (sidebar, thread list, persistence, composer).

Mount `@openuidev/react-ui`'s `<AgentInterface llm={fetchLLM({ url: "/api/chat",
streamAdapter: openAIAdapter(), messageFormat: openAIMessageFormat })}
componentLibrary={domainLibrary} />` and write a new `/api/chat` route that
returns a plain OpenAI SSE stream.

**Pros:** Less custom UI to maintain; gets OpenUI's built-in thread
persistence, starters, themes for free.

**Cons:**
- Throws away the current `agent-chat/*` component tree, the
  `LiveTickerBar`, the `AgentRuntimePanel`, the trace timeline, session
  search, `/learn` command, and the custom-tuned dark theme.
- The ReAct trace visualization (the project's headline feature) is lost —
  `<AgentInterface>` is a chat surface, not a ReAct inspector.
- **Not recommended** unless the project's identity pivots from
  "ReAct playground" to "production chat app".

**Verdict:** Skip unless explicitly requested.

---

### Pattern D — MCP bridge: feed our pooled MCP manager into OpenUI's renderer

**Effort:** ~2 hours (on top of Pattern B) · **Risk:** Very low · **Value:**
Lets OpenUI-rendered components invoke the same MCP tools the ReAct loop
uses — a generated form's "Submit" button can hit a Dhan order MCP tool.

OpenUI's `<Renderer>` accepts `toolProvider` which is either:
- a `Record<string, (args) => Promise<unknown>>` (function map), or
- any `McpClientLike` (duck-typed: has `callTool(name, args)`).

Our `McpClientManager` already has `callTool(fullName, args)` returning
`{ summary, data }` — a 10-line adapter converts it to the shape OpenUI
expects.

See spike code: `src/lib/openui/tool-provider.ts`.

**Pros:** Zero new infra; reuses the pooled MCP connection.
**Cons:** MCP tools are spawned per agent request today; for the renderer
to call them *after* the answer streams, we need to keep the connection
alive past the SSE close (the pool already does this — 10 min TTL).

---

## 4. Recommended rollout

| Phase | Pattern | Deliverable | Exit criteria |
|---|---|---|---|
| **1 (this branch)** | A + spike | `openui_gateway` provider in the config dialog; users can pick it and see OpenUI Lang stream as text | Provider appears in dropdown; `callLlm` reaches Gateway; auth errors are surfaced |
| **2** | B | Domain `Library` (5 components: `BinancePriceCard`, `OrderBookTable`, `TradeSetupCard`, `FundingRateChart`, `MarkdownFallback`); `<Renderer>` mounted in `agent-message.tsx` with Markdown fallback | Asking "show me BTC price + order book" renders interactive cards when using the `openui_gateway` provider; falls back to Markdown on other providers |
| **3** | D | `toolProvider` wired to `McpClientManager` + `executeLiveTool`; generated buttons can re-query Binance or call Dhan | A generated card's button click triggers a live MCP tool call and re-renders with fresh data |
| **4 (optional)** | C | A separate `/chat-v2` route that mounts `<AgentInterface>` as an *alternative* chat surface, leaving the existing ReAct playground intact | Power users can opt into the OpenUI-native chat UX without losing the ReAct inspector |

Phase 1 is on this branch as spike code. Phases 2–4 should be separate PRs
gated on real-world testing of Phase 1.

---

## 5. Concrete code sketches

### 5.1 Pattern A — add the provider

```ts
// src/lib/agent-types.ts (diff)
export type LlmProvider =
  | "ollama_local" | "ollama_cloud" | "openai" | "anthropic"
  | "gemini" | "groq" | "custom"
  | "openui_gateway"   // ← NEW

export const DEFAULT_PROVIDER_URLS: Record<LlmProvider, string> = {
  // …existing…
  openui_gateway: "https://api.thesys.dev/v1/embed",  // ← NEW
}
```

```ts
// src/app/api/models/route.ts (diff)
if (
  (provider === "openai" || provider === "groq" ||
   provider === "custom" || provider === "openui_gateway")  // ← add
  && apiKey
) { /* existing /models fetch */ }
```

No changes needed in `agent/route.ts` — `callLlm` is already provider-agnostic
for any OpenAI-compatible endpoint.

### 5.2 Pattern B — the renderer

```tsx
// src/components/agent-chat/openui-answer.tsx
"use client"
import { Renderer } from "@openuidev/react-lang"
import { domainLibrary } from "@/lib/openui/library"
import { buildToolProvider } from "@/lib/openui/tool-provider"
import { useAgentStore } from "@/store/agent-store"

export function OpenUIAnswerRenderer({
  content, isStreaming, mcpServerConfig,
}: {
  content: string
  isStreaming: boolean
  mcpServerConfig: McpServerConfig[]
}) {
  const config = useAgentStore((s) => s.config)
  // toolProvider bridges to executeLiveTool + pooled MCP manager
  const toolProvider = buildToolProvider({
    customTools: config.customTools,
    dhan: config.dhan,
    binance: config.binance,
    mcpServerConfig,
  })

  return (
    <Renderer
      response={content}
      library={domainLibrary}
      isStreaming={isStreaming}
      toolProvider={toolProvider}
      onError={(errs) => console.warn("[openui]", errs)}
    />
  )
}
```

The detector (cheap heuristic — no parser needed):

```ts
// src/lib/openui/detect.ts
export function looksLikeOpenUILang(s: string): boolean {
  if (!s || s.length < 4) return false
  // OpenUI Lang always opens with a component call: Foo(...props) { ... }
  return /^\s*[A-Z][A-Za-z0-9_]*\s*\(/.test(s)
      || /@(Run|Set|Reset|ToAssistant|OpenUrl)\b/.test(s)
      || /\bQuery\s*\(/.test(s)
}
```

### 5.3 Pattern B — a domain component

```tsx
// src/lib/openui/library.ts
import { createLibrary, defineComponent } from "@openuidev/react-lang"
import { openuiLibrary } from "@openuidev/react-ui"
import { z } from "zod"

const BinancePriceCard = defineComponent({
  name: "BinancePriceCard",
  description: "Live crypto price ticker card. Use for any 'show me the price of X' response.",
  props: z.object({
    symbol: z.string().describe("Uppercase Binance USD-M pair, e.g. BTCUSDT"),
    price: z.number().optional().describe("Last traded price (if known)"),
    change24hPct: z.number().optional(),
  }),
  component: function BinancePriceCard({ props }) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs text-muted-foreground">{props.symbol}</div>
        <div className="text-2xl font-mono">${props.price?.toFixed(2) ?? "—"}</div>
        {props.change24hPct != null && (
          <div className={props.change24hPct >= 0 ? "text-emerald-500" : "text-red-500"}>
            {props.change24hPct >= 0 ? "+" : ""}{props.change24hPct.toFixed(2)}% 24h
          </div>
        )}
      </div>
    )
  },
})

export const domainLibrary = createLibrary({
  root: openuiLibrary.root ?? "Stack",
  componentGroups: openuiLibrary.componentGroups,
  components: [
    ...Object.values(openuiLibrary.components),
    BinancePriceCard,
    // OrderBookTable, TradeSetupCard, FundingRateChart, MarkdownFallback …
  ],
})
```

### 5.4 Pattern D — the MCP/tool bridge

```ts
// src/lib/openui/tool-provider.ts
import type { McpServerConfig, CustomTool, DhanConfig, BinanceConfig } from "@/lib/agent-types"
import { executeLiveTool } from "@/lib/live-tools"
import { acquireConnection } from "@/lib/mcp/pool"
import { isMcpToolName } from "@/lib/mcp/types"

// OpenUI's `toolProvider` accepts either:
//   - Record<string, (args) => Promise<unknown>>    (function map)
//   - McpClientLike                                 (duck-typed: { callTool(name, args) })
// We bridge both: built-in tools go in the function map; MCP tools are
// routed through the pooled McpClientManager.
export function buildToolProvider(opts: {
  customTools: CustomTool[]
  dhan?: DhanConfig
  binance?: BinanceConfig
  mcpServerConfig: McpServerConfig[]
}): Record<string, (args: Record<string, unknown>) => Promise<unknown>> {
  const provider: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {}

  // Built-in live tools (binance_*, dhan_*, calculator, web_search, …)
  for (const name of [
    "binance_price", "binance_24hr_ticker", "binance_klines", "binance_order_book",
    "binance_funding_rate", "binance_open_interest", "binance_long_short_ratio",
    "prop_scan_setups", "prop_evaluate_pair", "prop_risk_calculator",
    "dhan_ltp", "dhan_quote", "dhan_holdings", "dhan_positions", "dhan_funds",
    "calculator", "weather_api", "web_search", "code_interpreter",
  ]) {
    provider[name] = async (args) => {
      const r = await executeLiveTool(name, args, opts.customTools, opts.dhan, opts.binance)
      return r.data
    }
  }

  // MCP tools — acquire a pooled connection lazily on first call.
  // The pool keeps the McpClientManager alive for 10 min idle, so
  // repeated calls during a session are cheap.
  let mcpConnPromise: ReturnType<typeof acquireConnection> | null = null
  const getMcp = () => {
    if (!mcpConnPromise) mcpConnPromise = acquireConnection(opts.mcpServerConfig)
    return mcpConnPromise
  }

  // The `Query()` / `Mutation()` DSL statements in OpenUI Lang invoke tools
  // by name; the user-authored component just calls `Query("binance_price",
  // { symbol: "BTCUSDT" })`. We register a single catch-all that routes MCP-
  // prefixed names to the pooled manager.
  provider.__mcp = async (args: { tool: string; args: Record<string, unknown> }) => {
    const conn = await getMcp()
    if (isMcpToolName(args.tool)) {
      const r = await conn.manager.callTool(args.tool, args.args)
      return r.data
    }
    return null
  }

  return provider
}
```

---

## 6. System-prompt generation

When the active provider is `openui_gateway`, the system prompt should be
augmented with the auto-generated OpenUI component spec. The
`@openuidev/lang-core` package ships `generateSystemPrompt({ cloud: true,
library })` for exactly this.

```ts
// src/lib/openui/prompt.ts
import { generateSystemPrompt } from "@openuidev/lang-core/cloud"
import { domainLibrary } from "./library"
import { getToolSystemPrompt } from "@/lib/live-tools"
import { formatMemoriesForPrompt } from "@/lib/memory-engine"

export function buildOpenUISystemPrompt(opts: {
  baseSystemPrompt: string
  memories: AgentMemoryItem[]
  query: string
  enabledTools: Record<string, boolean>
  customTools: CustomTool[]
  mcpTools: McpToolDescriptor[]
}): string {
  const componentSpec = generateSystemPrompt({
    cloud: true,
    library: domainLibrary,
    instructions: opts.baseSystemPrompt,
  })
  const toolBlock = getToolSystemPrompt(opts.enabledTools, opts.customTools, opts.mcpTools)
  const memoryBlock = formatMemoriesForPrompt(opts.memories, opts.query)
  return `${componentSpec}\n\n${toolBlock}\n${memoryBlock}\n\n` +
    `Respond in OpenUI Lang using the registered components. ` +
    `Prefer BinancePriceCard over a Markdown table for prices, etc.`
}
```

`generateSystemPrompt` is server-safe (no React import), so it can run in the
`/api/agent` route handler before calling `callLlm`.

---

## 7. Risks & open questions

| Risk | Mitigation |
|---|---|
| OpenUI Lang output from a non-Gateway model (e.g. local Ollama) is often malformed | Pattern B's `looksLikeOpenUILang` detector falls back to Markdown automatically. Gateway's mid-stream autofix only runs when using the `openui_gateway` provider. |
| Component library drift — the LLM tries to render components we haven't defined | `@openuidev/lang-core` ships a validator; `<Renderer onError>` reports unknown components. We render a `MarkdownFallback` card for unknown roots. |
| Token cost — the OpenUI system prompt adds ~1–2k tokens | Acceptable. We already cap `max_tokens` at 2048 and prune history to 14k chars. |
| MCP connection lifecycle for `toolProvider` — the pool keeps connections alive 10 min idle, which is exactly what we need | Already handled by `src/lib/mcp/pool.ts`. No changes required. |
| `next.config.ts` may need `transpilePackages` for `@openuidev/*` ESM | Add to `experimental.transpilePackages` if build fails. |
| `z-ai-web-dev-sdk` is already a dep — could be used instead of Gateway | Out of scope for this spike; revisit if we want a self-hosted OpenUI Lang validator. |

**Open questions:**
1. Do we want to keep the existing Markdown rendering for non-OpenUI providers
   (Pattern B's fallback), or always try to render via `<Renderer>` and fall
   back per-message? **Recommendation:** per-message fallback (cheaper, no
   config needed).
2. Should the OpenUI system prompt be appended on top of the existing ReAct
   prompt, or replace it? **Recommendation:** append — the ReAct instructions
   (Plan/Thought/Action/Observation) are still needed for tool-calling, and
   OpenUI Lang only applies to the Final Answer phase.
3. Should we self-host the OpenUI Lang validator (via `@openuidev/lang-core`)
   instead of paying for Gateway autofix? **Recommendation:** yes for
   production; Gateway for the spike only.

---

## 8. Spike deliverables on this branch

| Path | What it is | Status |
|---|---|---|
| `docs/openui-integration.md` | This document | ✅ |
| `src/lib/agent-types.ts` | Added `openui_gateway` to `LlmProvider` + `DEFAULT_PROVIDER_URLS`; added a `ModelOption` for the default Gateway model | ✅ (diff applied) |
| `src/app/api/models/route.ts` | `openui_gateway` handled in the OpenAI-compatible branch | ✅ (diff applied) |
| `src/lib/openui/library.ts` | Sketch of the domain `Library` (BinancePriceCard + MarkdownFallback) | ✅ (sketch) |
| `src/lib/openui/prompt.ts` | `buildOpenUISystemPrompt` wrapper around `generateSystemPrompt` | ✅ (sketch) |
| `src/lib/openui/detect.ts` | `looksLikeOpenUILang` heuristic | ✅ (sketch) |
| `src/lib/openui/tool-provider.ts` | Bridges `executeLiveTool` + pooled MCP manager into OpenUI's `toolProvider` | ✅ (sketch) |
| `src/components/agent-chat/openui-answer.tsx` | `<Renderer>` wrapper component | ✅ (sketch) |

The sketches are written but **not wired** — they're ready for the Phase 2
PR to pick up. To activate them:

1. `npm install @openuidev/react-lang @openuidev/react-ui @openuidev/lang-core`
2. Add `openui_gateway` to the provider dropdown in `agent-config-dialog.tsx`.
3. In `agent/route.ts`, when `config.provider === "openui_gateway"`, swap the
   system prompt builder to `buildOpenUISystemPrompt`.
4. In `agent-message.tsx`'s `TraceStepView` for `kind: "answer"`, branch on
   `looksLikeOpenUILang(content)` to mount `<OpenUIAnswerRenderer>` vs
   `<MarkdownView>`.

---

## 9. References

- OpenUI GitHub: https://github.com/thesysdev/openui
- OpenUI docs: https://www.openui.com/docs
- Quickstart: https://www.openui.com/docs/agent/getting-started/quickstart
- `react-lang` API: https://www.openui.com/docs/api-reference/react-lang
- Gateway overview: https://www.openui.com/docs/gateway
- Gateway pricing: https://www.openui.com/docs/gateway/pricing-credits
- Self-hosting: https://www.openui.com/docs/agent/reference/self-hosting
- Tools concept: https://www.openui.com/docs/agent/core-concepts/tools
- NPM packages: `@openuidev/react-lang`, `@openuidev/react-ui`,
  `@openuidev/lang-core`, `@openuidev/langchain` (all MIT)
