# Agentic Chat

[![CI](https://github.com/shubhamtaywade82/agentic-chat/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/shubhamtaywade82/agentic-chat/actions/workflows/ci.yml)
[![Deploy](https://github.com/shubhamtaywade82/agentic-chat/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/shubhamtaywade82/agentic-chat/actions/workflows/deploy.yml)

A Next.js 16 + TypeScript chat client for a [Nexum](https://github.com/shubhamtaywade82/nexum)
server. Nexum runs the agent (models, tools, skills, MCP, policy, credentials);
this app shows what the agent is doing and lets you steer it.

## What it does

- **Live run trace**: plans, thoughts, tool calls and observations appear as the
  run happens, with a final answer at the end.
- **Approvals and clarifications**: when a run needs your go-ahead (for example
  a destructive command) or has to ask a question, it pauses and shows an
  approve/deny or option card. Answering continues the same run.
- **Stop**: halts the run on the server, not just in the browser.
- **Generative UI (OpenUI)**: optionally lets the agent answer with cards,
  tables, charts and metrics where the data fits. Nexum decides when; plain text
  still renders as Markdown. See [docs/openui-integration.md](docs/openui-integration.md).
- **Capabilities browser**: the runtime panel and the Nexum dialog list the
  tools, skills, models and MCP servers the connected server reports.
- **Sessions**: chats are stored in this browser's localStorage and each is bound
  to one Nexum session, so the conversation continues across turns.

## What it does not do

It holds no model settings, API keys, tool configuration or credentials. All of
that belongs to the Nexum server. Older versions stored provider keys in
localStorage; they are deleted the first time this version loads.

## Quickstart

```bash
# 1. Start a Nexum server (needs PostgreSQL and Redis; see the Nexum README)
nexum serve                       # listens on http://127.0.0.1:3777

# 2. Install and run this app
npm install                       # or: bun install
npm run dev                       # http://localhost:3400
```

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXUM_HOST_URL` (or `NEXUM_SERVER_URL`) | Where the Nexum server is | `http://127.0.0.1:3777` |
| `NEXUM_SERVER_TOKEN` (or `NEXUM_TOKEN`) | Bearer token, required if the server is not on loopback | none |

The token is only ever used by this app's server-side routes; the browser never
sees it.

## Project layout

```
src/
├── app/
│   ├── api/
│   │   ├── agent/route.ts               # runs a turn on Nexum, streams events as SSE
│   │   ├── agent/interactions/route.ts  # answers an approval / clarification
│   │   ├── capabilities/route.ts        # proxies Nexum's /capabilities
│   │   ├── tool/route.ts                # read-only tool calls from generated UI, via Nexum
│   │   └── route.ts                     # health check
│   ├── openui/                          # OpenUI playground
│   └── page.tsx                         # the chat
├── components/
│   ├── agent-chat/                      # chat UI, trace steps, interaction cards, Nexum dialog
│   └── ui/                              # shadcn/ui primitives
├── lib/
│   ├── nexum/                           # Nexum client SDK + event translation (wire.ts)
│   ├── openui/                          # component spec, React library, prompt, tool provider
│   ├── agent-types.ts                   # trace and session types
│   ├── session-utils.ts                 # chat titles and search
│   └── trace-exporter.ts                # Markdown / JSON trace export
└── store/agent-store.ts                 # sessions, run lifecycle, capabilities (zustand)
```

## How a turn works

1. The browser posts the message to `/api/agent`.
2. The route creates (or reuses) the chat's Nexum session and starts a run,
   marked `interactive` so approvals reach this UI.
3. Nexum's events stream back and are translated into trace steps
   (`src/lib/nexum/wire.ts`).
4. Closing the connection (Stop, refresh, closed tab) makes the route cancel the
   Nexum run.
5. If the chat's session already has a run in progress (a second tab), the route
   follows that run and says your message was not sent.

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

## License

MIT
