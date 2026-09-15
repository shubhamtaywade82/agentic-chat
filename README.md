# Agentic Chat — ReAct Agent Playground

[![CI](https://github.com/shubhamtaywade82/agentic-chat/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/shubhamtaywade82/agentic-chat/actions/workflows/ci.yml)
[![Deploy](https://github.com/shubhamtaywade82/agentic-chat/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/shubhamtaywade82/agentic-chat/actions/workflows/deploy.yml)

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
- **MCP (Model Context Protocol) integration** — extend the agent's tool
  surface dynamically by plugging in any MCP server. All 7 official reference
  servers are pre-configured and enabled by default (memory, time,
  sequential-thinking, fetch, everything, filesystem, git). See
  [MCP section](#mcp-model-context-protocol) below.
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
│   ├── live-tools.ts               # Tool dispatcher (Binance/Dhan/general + MCP prompt injection)
│   ├── mcp/                         # MCP integration (types, registry, client manager)
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
| `npm run typecheck` | TypeScript typecheck (`tsc --noEmit`) |
| `npm run ci` | Lint + typecheck + build in one shot (mirrors CI) |
| `npm run db:push` | Apply Prisma schema to the SQLite DB |
| `npm run db:generate` | Regenerate the Prisma client |

## CI/CD

The repo ships with two GitHub Actions workflows:

### `ci.yml` — quality gate (runs on every PR and push to `main` / `develop`)

1. Checkout + setup Node 20 LTS (with `npm` cache)
2. `npm ci` — install dependencies from lockfile
3. `npm run lint` — ESLint
4. `npm run typecheck` — `tsc --noEmit`
5. `npm run build` — `next build` with standalone output
6. Smoke-test the built server — boots `node .next/standalone/server.js`, polls `/api` until it returns `{status:"ok"}`, then kills it. Catches runtime import errors that `tsc` can't see.
7. Upload the standalone build as a workflow artifact (only on `main`, 7-day retention)

Superseded runs on the same branch are cancelled (`concurrency: cancel-in-progress`).

### `deploy.yml` — deploy gate (runs on push to `main`)

1. **Wait for CI** — polls the `ci.yml` runs for the pushed commit. Fails fast if CI didn't pass or timed out (10 min).
2. **Build standalone artifact** — rebuilds the standalone output and tars it (with `public/`) into a `deploy/` folder, uploaded as artifact `deploy-<sha>` (30-day retention).
3. **Deploy (placeholder)** — intentional no-op step that prints instructions for wiring up your real deploy target (VPS via SCP/rsync, Docker registry, Cloud Run, Fly.io, Vercel, etc.). Edit this step once you know your target.

### Running CI locally

```bash
npm run ci    # lint + typecheck + build, same as CI
```

If that passes locally, CI will pass on GitHub Actions.

### Local-only files

The Z.ai Code sandbox-specific scripts under `.zscripts/` are platform hooks
(used only inside the Z.ai Code sandbox), not part of the application. Runtime
PIDs and logs in `.zscripts/` are gitignored.

## MCP (Model Context Protocol)

This app integrates the [Model Context Protocol](https://modelcontextprotocol.io) so the agent's tool surface can be extended dynamically — without writing new code or rebuilding. Plug in any MCP server (local via stdio, or remote via HTTP/SSE) and its tools become immediately available to the agent's ReAct loop.

### Pre-configured reference servers

All 7 official reference MCP servers are pre-configured in `DEFAULT_CONFIG.mcpServers` and enabled by default. Open **Configure Agent → MCP tab** to toggle them or edit their args.

| Server | Transport | Package | Default | Tools |
| --- | --- | --- | --- | --- |
| `memory` | stdio (npx) | `@modelcontextprotocol/server-memory` | enabled | 9 — knowledge graph (entities, relations, observations) |
| `time` | stdio (uvx) | `mcp-server-time` | enabled | 2 — current time, timezone conversion |
| `sequentialthinking` | stdio (npx) | `@modelcontextprotocol/server-sequential-thinking` | enabled | 1 — dynamic thought sequences |
| `fetch` | stdio (uvx) | `mcp-server-fetch` | enabled | 1 — web content → markdown |
| `everything` | stdio (npx) | `@modelcontextprotocol/server-everything` | enabled | 13 — reference/test tools (echo, add, long-running-op, …) |
| `filesystem` | stdio (npx) | `@modelcontextprotocol/server-filesystem /tmp` | enabled | 14 — read/write/list/search files |
| `git` | stdio (uvx) | `mcp-server-git --repository .` | disabled | 12 — status, diff, log, commit, branch, … |

Discovered tool count: **52 tools** across 7 servers (verified end-to-end).

### How it works

1. When the user sends a chat message, the `/api/agent` route spawns the `McpClientManager` (`src/lib/mcp/client.ts`).
2. The manager connects to every enabled MCP server **in parallel** (stdio = spawn child process; http/sse = open HTTP/SSE connection).
3. Each server's `listTools()` is called and the union of all tools is gathered.
4. The MCP tools are appended to the LLM's system prompt alongside the built-in live tools, using the `mcp__<serverSlug>__<toolName>` naming convention so they're unambiguously routed back to the originating server.
5. During the ReAct loop, if the agent emits an Action whose tool name starts with `mcp__`, the call is dispatched to the MCP manager; otherwise it goes to the built-in `executeLiveTool`.
6. In a `finally` block, all MCP connections are closed — no orphan child processes.

Failures are isolated: a single broken server is logged and skipped, the rest of the agent loop proceeds normally.

### Managing MCP servers

Open **Configure Agent** (top-right gear) → **MCP** tab. From there you can:

- **Toggle** any pre-configured server on/off.
- **Test** a server — spawns it, lists tools, shows a preview of the first 10 tool names + descriptions, reports errors.
- **Edit** a server — change command, args, env vars (for stdio) or URL/headers (for http/sse).
- **Add** a custom server — pick transport (stdio | http | sse), fill in the config, save.
- **Remove** a server you no longer need.

The agent runtime panel (right sidebar) shows a live `N MCP` chip and lists each enabled MCP server as a `mcp:<name>` chip in the tools list.

### Adding a remote MCP server

In the MCP tab, click **Add Server**, pick `http` or `sse` transport, and enter the server URL. Add any required auth headers (e.g. `Authorization: Bearer <token>`) in the headers field — they'll be sent on every request.

```json
{
  "name": "my-remote-server",
  "transport": "http",
  "url": "https://mcp.example.com/mcp",
  "headers": { "Authorization": "Bearer xxx" },
  "enabled": true
}
```

### Adding a local stdio MCP server

Pick `stdio` transport, enter a command and one arg per line. Environment variables are `KEY=value`, one per line.

```json
{
  "name": "github",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx" },
  "enabled": true
}
```

### MCP API endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /api/mcp/tools` | Body: `{ servers: McpServerConfig[] }`. Returns the flattened list of all tools across all enabled servers. Used by the MCP tab to show tool counts. |
| `POST /api/mcp/test` | Body: `{ server: McpServerConfig }`. Tests a single server connection and returns the tool list (or error). Used by the Test button. |

### MCP file layout

```
src/lib/mcp/
├── types.ts        # McpServerConfig, McpToolDescriptor, slug + name helpers
├── registry.ts     # 7 pre-configured reference servers (buildDefaultMcpServers)
└── client.ts      # McpClientManager — connectAll, callTool, closeAll

src/app/api/mcp/
├── tools/route.ts  # POST: list tools from all configured servers
└── test/route.ts   # POST: test a single server connection

src/components/agent-chat/
└── mcp-tab.tsx     # UI for managing MCP servers (add/edit/test/toggle/remove)
```

## License

MIT
