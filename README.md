# Agentic Chat — ReAct Agent Playground

An interactive Next.js 16 + TypeScript app that visualizes the agentic
**ReAct (Reason + Act + Observe)** loop in real time. It connects directly to
real LLM providers (Ollama, OpenAI, Anthropic, Gemini, Groq), executes live
tools (Binance USD-M market data, DhanHQ Indian markets, prop-trading SMC/ICT
scanners), and renders the full reasoning trace as a polished UI.

## Features

- **Live ReAct loop visualization** — every Thought / Plan / Action /
  Observation / Final Answer is rendered as a timeline step with token and
  duration telemetry.
- **Multi-provider LLM support** — Ollama (local/cloud), OpenAI, Anthropic,
  Gemini, Groq, or any OpenAI-compatible custom endpoint.
- **Live tool execution** — Binance USD-M (price, klines, depth, funding rate,
  open interest, long/short ratio), DhanHQ Indian markets (LTP, holdings,
  positions, funds), and built-in calculator / weather / web-search / code
  interpreter tools.
- **Prop-trading engine** — Smart Money Concepts (SMC) / ICT setup scanner
  (FVG, Order Blocks, Liquidity Pools, Market Structure, AMD cycles, Judas
  swings, OTE zone, Silver Bullet windows) with multi-target RRR planning.
- **Long-term memory** — `/learn <text>` in chat saves persistent memories that
  get ranked by relevance and injected into every prompt.
- **Multi-session** — sessions are persisted to localStorage with full-text
  search and rename / delete.
- **Futures dashboard** — `/dashboard` shows a TradingAgents-style multi-agent
  layout: live price chart (lightweight-charts), order book WebSocket, setups,
  sentiment, event-driven triggers.
- **Custom tool extensions** — define JavaScript / HTTP / static JSON tools
  in the UI and they become available to the agent's ReAct loop.

## Quickstart

```bash
# 1. Install dependencies
npm install        # or: bun install

# 2. (optional) Configure env vars
cp .env.example .env.local
# Edit .env.local to add Dhan/Binance credentials if needed.

# 3. Run Prisma (optional — only if you plan to extend with server-side DB)
npm run db:generate
npm run db:push

# 4. Start dev server
npm run dev
# Open http://localhost:3400
```

### Default LLM provider

The default provider is `ollama_local` pointing at `http://localhost:11434`.
If you don't have Ollama installed, open **Configure Agent** (top-right
gear button) and switch to OpenAI / Groq / Anthropic / Gemini, then paste your
API key.

## Project layout

```
src/
├── app/
│   ├── api/
│   │   ├── agent/route.ts          # SSE ReAct loop endpoint
│   │   ├── models/route.ts         # Lists models from the active provider
│   │   ├── futures/{klines,depth,sentiment,setups,positions}/  # Market data
│   │   ├── trading/test/route.ts   # Tests Dhan/Binance connection
│   │   └── route.ts                # Health check
│   ├── dashboard/page.tsx          # /dashboard — multi-agent view
│   └── page.tsx                    # / — chat playground
├── components/
│   ├── agent-chat/                 # Chat UI, trace steps, sidebar, config
│   ├── futures-dashboard/          # Dashboard panels
│   └── ui/                         # shadcn/ui primitives
├── lib/
│   ├── agent-types.ts              # AgentConfig, TraceStep, AVAILABLE_TOOLS
│   ├── live-tools.ts               # Tool dispatcher (Binance/Dhan/general)
│   ├── prop-engine.ts              # SMC/ICT setup evaluator
│   ├── memory-engine.ts           # Memory ranking + /learn parsing
│   ├── trace-exporter.ts          # Markdown / JSON trace export
│   └── use-live-stream.ts         # Binance WebSocket tick streamer
└── store/
    ├── agent-store.ts              # Sessions, config, sendUserMessage (zustand)
    └── dashboard-store.ts          # Dashboard symbol/interval prefs (zustand)

packages/
├── binance-client-ts/              # Local lightweight Binance USD-M client
└── chart-sdk/                      # Local SMC/ICT technical analysis detectors
```

## Architecture notes

- The ReAct loop runs server-side in `src/app/api/agent/route.ts` as an SSE
  stream. Each step (Plan, Thought, Action, Observation, Answer) is sent as a
  JSON line; the client appends it to the active message's trace.
- The agent uses a text-based ReAct protocol (`Plan:` / `Thought:` /
  `Action:` / `Action Input:` / `Final Answer:`). The `parseAction` helper
  accepts JSON-encoded, standard, and natural-language tool-call formats.
- The local `binance-client-ts` package wraps the public Binance USD-M REST
  API and adds optional HMAC-SHA256 signing for the few authenticated
  endpoints used (e.g. `positionRisk`).
- The local `chart-sdk` package implements deterministic SMC/ICT detectors
  (FVG, Order Blocks, Liquidity Pools, Market Structure, OTE, AMD cycles,
  Judas swings, etc.) and a combined `scanSetups` that produces a LONG /
  SHORT / NO_TRADE direction with a confluence breakdown.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js dev server on port 3400 |
| `npm run build` | Production build (standalone output) |
| `npm run start` | Run the production standalone server |
| `npm run lint` | ESLint (next/core-web-vitals + typescript) |
| `npm run db:push` | Apply Prisma schema to the SQLite DB |
| `npm run db:generate` | Regenerate the Prisma client |

## License

MIT
