# Binance Futures Trading Dashboard — Design

Status: approved (scope + layout swap confirmed in chat 2026-08-17)

## Purpose

Add a read-only monitoring dashboard for Binance USD-M futures, covering
both intraday and swing trading workflows, alongside the existing
ReAct Agent Playground. Not a replacement for it — a second page in the
same app.

## Scope

**In scope:**
- Live watchlist (price, 24h change) for a configurable symbol set
- Candlestick price chart with two timeframe modes:
  - Intraday: 1m / 5m / 15m / 1h
  - Swing: 4h / 1d / 1w
- Order book depth (bids/asks) for the active symbol
- Sentiment panel: funding rate, open interest, long/short ratio
- Positions panel: open positions + unrealized PnL (read-only; requires
  Binance API key/secret already configured in the agent's config)

**Out of scope (explicitly deferred):**
- Placing, modifying, or cancelling orders from the dashboard UI
- Paper trading UI (SDK's `PaperTradingEngine` exists but isn't wired up)
- Alerts/notifications
- Any write/signed action beyond reading account data

This keeps the dashboard fully read-only, so none of CLAUDE.md's
order-execution safety rules (max order size, kill switch, confirmations)
apply yet. If order execution is wanted later, that's a new spec.

## Prior work (already done, not part of this plan)

- Sidebar/runtime panel split on the Agent Playground page: left sidebar
  now shows only Chat Sessions; a new right-side `AgentRuntimePanel`
  shows the ReAct visualizer, session telemetry, and memory/tools status.
  Files: `src/components/agent-chat/sidebar.tsx` (trimmed),
  `src/components/agent-chat/agent-runtime-panel.tsx` (new),
  `src/components/agent-chat/index.tsx` (wires the new right `<aside>`).

## Architecture

New route: `src/app/dashboard/page.tsx` renders `<FuturesDashboard />`.

New component directory: `src/components/futures-dashboard/`.

New server-side API routes under `src/app/api/futures/` wrap the
already-installed `binance-client-ts` SDK via the existing
`resolveBinanceClient` helper in `src/lib/live-tools.ts` (reused, not
duplicated). Credentials never reach the client — routes call the SDK
server-side and return plain JSON.

Reused, not rebuilt:
- `src/lib/use-live-stream.ts` — existing hook that opens a direct
  browser → `wss://fstream.binance.com` connection for live ticks. Already
  used by the agent's `LiveTickerBar`. The dashboard's watchlist uses the
  same hook, just with a dashboard-controlled symbol list.
- `config.binance` (apiKey/apiSecret/testnet) from `useAgentStore` — the
  same Binance credentials already entered via the agent's config dialog.
  No second credentials form.

New dependency: `lightweight-charts` (TradingView's charting library,
~45kb, MIT license) for the candlestick chart. `recharts` (already
installed) doesn't render OHLC candlesticks natively; this is a single,
purpose-built addition rather than hand-rolling candle rendering.

## Components

All new, under `src/components/futures-dashboard/`:

1. **`FuturesDashboard.tsx`** — grid layout root. Holds `activeSymbol`
   state (default `BTCUSDT`) and passes it down. Top-level header with a
   symbol search/switcher and a link back to the Agent Playground.

2. **`Watchlist.tsx`** — list of symbols with live price/24h change via
   `useLiveStream`. Click a row to set `activeSymbol`. Add/remove symbols
   (mirrors the existing `LiveTickerBar` add/remove pattern).

3. **`PriceChart.tsx`** — candlestick chart via `lightweight-charts`.
   Two tabs: **Intraday** (1m/5m/15m/1h) and **Swing** (4h/1d/1w). Fetches
   from `POST /api/futures/klines`. Refetches on
   symbol or interval change; no live WS candle updates in v1 (REST
   refresh only — polling cadence: refetch on interval/symbol change, plus
   a 15s interval timer while the tab is visible).

4. **`SentimentPanel.tsx`** — funding rate, open interest, long/short
   ratio for `activeSymbol`, via `POST /api/futures/sentiment`.

5. **`PositionsPanel.tsx`** — open positions + unrealized PnL via
   `POST /api/futures/positions`. If `config.binance.apiKey` is empty,
   renders an empty-state ("Add a Binance API key in Agent Config to see
   live positions") instead of calling the endpoint.

6. **`OrderBookPanel.tsx`** — bid/ask depth for `activeSymbol` via
   `POST /api/futures/depth`.

## API Routes

All under `src/app/api/futures/`, mirroring the existing
`src/app/api/trading/test/route.ts` error-handling pattern
(try/catch → `NextResponse.json({ success: false, error })`, 500 on
failure). All accept `binance` config (apiKey/apiSecret/testnet) in the
**POST JSON body** — not as query params, which would put `apiSecret` in a
URL for the positions route. `resolveBinanceClient` has no `process.env`
fallback for Binance (unlike `resolveDhanClient`); absent credentials mean
an unauthenticated client, which is fine for the three public routes.

| Route | Method | SDK call | Notes |
|---|---|---|---|
| `/api/futures/klines` | POST | `client.futures.market.klines(symbol, interval, { limit })` | intraday/swing intervals from the UI tabs |
| `/api/futures/depth` | POST | `client.futures.market.depth(symbol, limit)` | order book panel |
| `/api/futures/sentiment` | POST | `client.futures.data.fundingRateHistory`, `.openInterest`, `.globalLongShortAccountRatio` (parallel) | combined into one response to avoid 3 client round-trips |
| `/api/futures/positions` | POST | `client.futures.account.positionRisk()` | signed; requires apiKey+secret |

Only `PositionsPanel` sends `binance`. The three market panels send just a
symbol, so they always read **mainnet** even when `config.binance.testnet`
is set — testnet positions would sit alongside mainnet prices. Acceptable
for v1; pass `binance` to all four panels if testnet becomes a real workflow.

No new WS server infra — ticks stay on the existing direct-to-Binance
browser WS (`use-live-stream.ts`); everything else is REST via these
routes.

## Data Flow

```
Browser
  ├─ useLiveStream (existing hook) ──── wss://fstream.binance.com ──→ live ticks (watchlist)
  └─ fetch() ──→ /api/futures/*  ──→ resolveBinanceClient(config.binance) ──→ Binance REST
                                          (server-side, key never leaves server)
```

`activeSymbol` state lives in `FuturesDashboard.tsx` and flows down as a
prop — no new global store needed. `config.binance` reads from the
existing `useAgentStore`, so the dashboard and the agent share one
credentials source of truth.

## Error Handling

- API routes: try/catch, `{ success: false, error }` JSON on failure,
  matching `trading/test/route.ts`'s existing pattern. No throws leak to
  the client.
- UI panels: each panel owns its own loading/error/empty state. A failed
  fetch shows an inline error message in that panel only — one panel
  failing (e.g. sentiment endpoint down) never blanks the rest of the
  dashboard. Polling panels (chart, order book, positions) clear the error
  on the next successful poll; the sentiment panel has no retry until the
  symbol changes (see follow-ups).
- Positions panel specifically: missing API key is not an error state,
  it's an expected empty-state with a clear call to action.

## Navigation

A simple link/tab between "Agent" and "Dashboard" in a shared header
element — no auth, no routing complexity. Single-user local tool.

## Testing

- `curl` smoke check per new API route (mirrors how the agent fix was
  verified) — confirms each route returns valid JSON for a known symbol.
- Live check via Chrome: load `/dashboard`, confirm watchlist ticks live,
  switch symbols, switch Intraday/Swing tabs, confirm chart/sentiment/
  order book update, confirm positions panel empty-state when no API key
  is configured.
- No new test framework introduced (none exists in this repo currently).

## Out-of-scope follow-ups (not part of this plan)

- Header symbol search/switcher (§Components 1) — not built; symbol
  selection is watchlist-click only.
- Watchlist add/remove symbols (§Components 2) — not built; the watchlist
  shows `useLiveStream`'s five default symbols. The hook already exposes
  `addSymbol`/`removeSymbol`, so this is UI-only work.
- Explicit retry buttons on panel errors, and a manual refresh for the
  sentiment panel (the only panel that doesn't poll).
- Chart colors are hardcoded hex tuned for a dark background; the app
  currently renders light-only (no `ThemeProvider` is mounted). Pull from
  theme tokens whenever theming is wired up.
- Order execution UI (would need the CLAUDE.md financial/safety-critical
  rules: Decimal math, max order size, kill switch, confirmations)
- Wiring up `PaperTradingEngine` for simulated order entry
- Live WS candle updates (v1 is REST-refresh only)
