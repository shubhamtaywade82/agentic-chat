/**
 * OpenUI domain component library for agentic-chat.
 *
 * This is the live, activated library (Pattern B from
 * docs/openui-integration.md). It defines the React components that the
 * OpenUI `<Renderer>` will mount when the LLM emits OpenUI Lang.
 *
 * We do NOT depend on `@openuidev/react-ui` (the full `<AgentInterface>`
 * chat surface) — it has a peer-dep conflict with our `zustand@5`. We
 * therefore define our own `Stack` / `Text` / `MarkdownFallback` roots
 * plus the trading-domain components (`BinancePriceCard`,
 * `OrderBookTable`, `TradeSetupCard`, `FundingRateChart`,
 * `RiskCalculatorCard`).
 *
 * The LLM is instructed (via buildOpenUISystemPrompt in prompt.ts) to
 * prefer these components over Markdown tables for the Final Answer.
 */

import type React from "react"
import {
  createLibrary,
  defineComponent,
  useTriggerAction,
  useRenderNode,
  type ComponentRenderProps,
} from "@openuidev/react-lang"
import { z } from "zod"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

// ─── Root layout components ───────────────────────────────────────────

/**
 * Vertical stack — the default root for an OpenUI Lang response.
 * Renders children top-to-bottom with a configurable gap.
 */
const Stack = defineComponent({
  name: "Stack",
  description:
    "Vertical layout container. Use as the root of every response to " +
    "stack multiple cards/charts vertically. Children render top-to-bottom.",
  props: z.object({
    gap: z
      .enum(["xs", "sm", "md", "lg"])
      .optional()
      .describe("Vertical gap between children. Default: md."),
    children: z
      .array(z.unknown())
      .optional()
      .describe("Child components to stack."),
  }),
  component: function Stack({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as { gap?: string; children?: unknown[] }
    const renderNode = useRenderNode()
    const gapClass =
      p.gap === "xs" ? "gap-1"
      : p.gap === "sm" ? "gap-2"
      : p.gap === "lg" ? "gap-6"
      : "gap-4"
    const children = Array.isArray(p.children) ? p.children : []
    return (
      <div className={`flex flex-col ${gapClass}`}>
        {children.map((child, i) => {
          if (child && typeof child === "object") {
            return <div key={i}>{renderNode(child as Parameters<typeof renderNode>[0])}</div>
          }
          return <div key={i}>{String(child)}</div>
        })}
      </div>
    )
  },
})

/**
 * Plain text block — for short inline labels, headings, or callouts.
 */
const Text = defineComponent({
  name: "Text",
  description: "Plain text block. Use for headings, callouts, or labels.",
  props: z.object({
    content: z.string().describe("The text to display."),
    variant: z
      .enum(["default", "muted", "heading", "small"])
      .optional()
      .describe("Visual style. Default: default."),
  }),
  component: function Text({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as { content?: string; variant?: string }
    const cls =
      p.variant === "heading"
        ? "text-base font-semibold text-foreground"
        : p.variant === "muted"
        ? "text-xs text-muted-foreground"
        : p.variant === "small"
        ? "text-[11px] text-muted-foreground"
        : "text-sm text-foreground"
    return <div className={cls}>{p.content ?? ""}</div>
  },
})

// ─── Markdown fallback ────────────────────────────────────────────────

/**
 * Markdown fallback — used by the renderer when the LLM emits OpenUI Lang
 * whose root component is unknown. Renders the raw Markdown source as
 * plain text in a card. For fully-rendered Markdown, the client-side
 * `looksLikeOpenUILang` detector in `trace-step.tsx` falls back to the
 * existing `<Markdown>` component BEFORE the OpenUI renderer is even
 * mounted — so this component is only hit when the model emits valid
 * OpenUI Lang with an unknown root component name.
 *
 * We deliberately do NOT import `@/components/agent-chat/markdown` here
 * because that pulls in `react-syntax-highlighter` which is incompatible
 * with the server-side route handler (`/api/agent`) that also imports
 * this library via `prompt.ts` for system-prompt generation.
 */
const MarkdownFallback = defineComponent({
  name: "MarkdownFallback",
  description:
    "Fallback renderer for Markdown content. Use ONLY when no domain " +
    "component fits — prefer BinancePriceCard, OrderBookTable, etc.",
  props: z.object({
    content: z.string().describe("Markdown source to display as plain text."),
  }),
  component: function MarkdownFallback({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as { content?: string }
    return (
      <Card className="gap-0 rounded-xl border-border p-4 shadow-sm">
        <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
          {p.content ?? ""}
        </pre>
      </Card>
    )
  },
})

// ─── Trading domain components ────────────────────────────────────────

/**
 * Binance price ticker card. Use for any "show me the price of X" response.
 */
const BinancePriceCard = defineComponent({
  name: "BinancePriceCard",
  description:
    "Live crypto price ticker card. Use for any 'show me the price of X' " +
    "response where X is a Binance USD-M pair (BTCUSDT, SOLUSDT, etc.).",
  props: z.object({
    symbol: z
      .string()
      .describe("Uppercase Binance USD-M pair, e.g. BTCUSDT"),
    price: z
      .number()
      .optional()
      .describe("Last traded price (if known at generation time)"),
    change24hPct: z
      .number()
      .optional()
      .describe("24h price change percent"),
    high24h: z.number().optional().describe("24h high"),
    low24h: z.number().optional().describe("24h low"),
    volume24h: z.number().optional().describe("24h quote volume"),
  }),
  component: function BinancePriceCard({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as {
      symbol?: string
      price?: number
      change24hPct?: number
      high24h?: number
      low24h?: number
      volume24h?: number
    }
    const up = (p.change24hPct ?? 0) >= 0
    return (
      <Card className="gap-0 rounded-xl border-border p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-mono text-muted-foreground">
            {p.symbol ?? "—"}
          </div>
          {p.change24hPct != null && (
            <div
              className={
                "text-xs font-mono " +
                (up ? "text-emerald-500" : "text-red-500")
              }
            >
              {up ? "+" : ""}
              {p.change24hPct.toFixed(2)}% 24h
            </div>
          )}
        </div>
        <div className="mt-1 text-2xl font-mono font-semibold text-foreground">
          ${p.price != null ? p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
        </div>
        {(p.high24h != null || p.low24h != null) && (
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground font-mono">
            <span>L: {p.low24h?.toLocaleString() ?? "—"}</span>
            <span>H: {p.high24h?.toLocaleString() ?? "—"}</span>
          </div>
        )}
        {p.volume24h != null && (
          <div className="mt-1 text-[10px] text-muted-foreground font-mono">
            Vol: {p.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        )}
      </Card>
    )
  },
})

/**
 * Order book depth table — bids and asks side by side.
 */
const OrderBookTable = defineComponent({
  name: "OrderBookTable",
  description:
    "Order book depth table for a Binance USD-M pair. Shows top N bids " +
    "and asks with price + quantity.",
  props: z.object({
    symbol: z.string().describe("Trading pair, e.g. BTCUSDT"),
    bids: z
      .array(z.tuple([z.number(), z.number()]))
      .max(20)
      .describe("Top bids as [[price, qty], …]"),
    asks: z
      .array(z.tuple([z.number(), z.number()]))
      .max(20)
      .describe("Top asks as [[price, qty], …]"),
  }),
  component: function OrderBookTable({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as {
      symbol?: string
      bids?: Array<[number, number]>
      asks?: Array<[number, number]>
    }
    const Row = ({ p, q, side }: { p: number; q: number; side: "bid" | "ask" }) => (
      <TableRow className={cn("border-0 hover:bg-transparent", side === "bid" ? "text-emerald-500" : "text-red-500")}>
        <TableCell className="h-auto px-2 py-0.5 text-right font-mono">
          {p.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </TableCell>
        <TableCell className="h-auto px-2 py-0.5 text-right font-mono">
          {q.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </TableCell>
      </TableRow>
    )
    return (
      <Card className="gap-0 rounded-xl border-border p-3 shadow-sm">
        <div className="mb-2 text-xs font-mono text-muted-foreground">
          {p.symbol ?? "—"} · Order Book
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Table>
            <TableHeader>
              <TableRow className="border-0 text-muted-foreground hover:bg-transparent">
                <TableHead className="h-auto px-2 py-0.5 text-right">Bid</TableHead>
                <TableHead className="h-auto px-2 py-0.5 text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(p.bids ?? []).slice(0, 10).map(([bp, bq], i) => (
                <Row key={`b${i}`} p={bp} q={bq} side="bid" />
              ))}
            </TableBody>
          </Table>
          <Table>
            <TableHeader>
              <TableRow className="border-0 text-muted-foreground hover:bg-transparent">
                <TableHead className="h-auto px-2 py-0.5 text-right">Ask</TableHead>
                <TableHead className="h-auto px-2 py-0.5 text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(p.asks ?? []).slice(0, 10).map(([ap, aq], i) => (
                <Row key={`a${i}`} p={ap} q={aq} side="ask" />
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    )
  },
})

/**
 * Trade setup card — for prop_scan_setups / prop_evaluate_pair results.
 */
const TradeSetupCard = defineComponent({
  name: "TradeSetupCard",
  description:
    "Trade setup card showing direction, confluence score, entry, SL, " +
    "and TP1/2/3. Use for prop_scan_setups or prop_evaluate_pair results.",
  props: z.object({
    symbol: z.string(),
    direction: z
      .enum(["LONG", "SHORT", "NO_TRADE"])
      .describe("Setup direction. NO_TRADE means no actionable setup."),
    confluenceScore: z
      .number()
      .int()
      .min(0)
      .max(6)
      .optional()
      .describe("Number of confluence factors (0–6)."),
    entry: z.number().optional().describe("Entry price"),
    stopLoss: z.number().optional().describe("Stop-loss price"),
    takeProfits: z
      .array(z.number())
      .max(3)
      .optional()
      .describe("TP1, TP2, TP3 prices"),
    rrr: z.number().optional().describe("Risk-to-reward ratio"),
    invalidation: z
      .string()
      .optional()
      .describe("What invalidates the setup"),
  }),
  component: function TradeSetupCard({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as {
      symbol?: string
      direction?: string
      confluenceScore?: number
      entry?: number
      stopLoss?: number
      takeProfits?: number[]
      rrr?: number
      invalidation?: string
    }
    const dir =
      p.direction === "LONG"
        ? { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "LONG" }
        : p.direction === "SHORT"
        ? { color: "text-red-500", bg: "bg-red-500/10", label: "SHORT" }
        : { color: "text-muted-foreground", bg: "bg-muted", label: "NO TRADE" }
    return (
      <Card className="gap-0 rounded-xl border-border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono text-muted-foreground">
            {p.symbol ?? "—"}
          </div>
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${dir.bg} ${dir.color}`}>
            {dir.label}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono">
          {p.entry != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entry</span>
              <span>{p.entry.toLocaleString()}</span>
            </div>
          )}
          {p.stopLoss != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">SL</span>
              <span className="text-red-500">{p.stopLoss.toLocaleString()}</span>
            </div>
          )}
          {p.takeProfits?.map((tp, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-muted-foreground">TP{i + 1}</span>
              <span className="text-emerald-500">{tp.toLocaleString()}</span>
            </div>
          ))}
          {p.rrr != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">RRR</span>
              <span>{p.rrr.toFixed(2)}</span>
            </div>
          )}
          {p.confluenceScore != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confluence</span>
              <span>{p.confluenceScore}/6</span>
            </div>
          )}
        </div>
        {p.invalidation && (
          <div className="mt-2 text-[10px] text-muted-foreground">
            <span className="font-medium">Invalidation:</span> {p.invalidation}
          </div>
        )}
      </Card>
    )
  },
})

/**
 * Funding rate card — for binance_funding_rate results.
 */
const FundingRateCard = defineComponent({
  name: "FundingRateCard",
  description:
    "Funding rate card for a Binance USD-M perpetual. Shows current rate, " +
    "next funding time, and a 5-rate history sparkline.",
  props: z.object({
    symbol: z.string(),
    currentRate: z
      .number()
      .optional()
      .describe("Current funding rate as a fraction (0.0001 = 0.01%)"),
    nextFundingTime: z
      .string()
      .optional()
      .describe("ISO 8601 timestamp of next funding"),
    history: z
      .array(z.number())
      .max(10)
      .optional()
      .describe("Recent funding rates, oldest first"),
  }),
  component: function FundingRateCard({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as {
      symbol?: string
      currentRate?: number
      nextFundingTime?: string
      history?: number[]
    }
    const ratePct = p.currentRate != null ? p.currentRate * 100 : undefined
    const positive = (ratePct ?? 0) >= 0
    return (
      <Card className="gap-0 rounded-xl border-border p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-mono text-muted-foreground">
            {p.symbol ?? "—"} · Funding
          </div>
          {ratePct != null && (
            <div
              className={
                "text-lg font-mono font-semibold " +
                (positive ? "text-emerald-500" : "text-red-500")
              }
            >
              {positive ? "+" : ""}
              {ratePct.toFixed(4)}%
            </div>
          )}
        </div>
        {p.nextFundingTime && (
          <div className="mt-1 text-[10px] text-muted-foreground font-mono">
            Next: {new Date(p.nextFundingTime).toLocaleString()}
          </div>
        )}
        {p.history && p.history.length > 0 && (
          <div className="mt-2 flex h-8 items-end gap-0.5">
            {p.history.map((r, i) => {
              const max = Math.max(...p.history!.map((x) => Math.abs(x))) || 1
              const h = Math.max(2, (Math.abs(r) / max) * 100)
              return (
                <div
                  key={i}
                  className={`w-1.5 ${r >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                  style={{ height: `${h}%` }}
                  title={(r * 100).toFixed(4) + "%"}
                />
              )
            })}
          </div>
        )}
      </Card>
    )
  },
})

/**
 * Risk calculator card — for prop_risk_calculator results.
 */
const RiskCalculatorCard = defineComponent({
  name: "RiskCalculatorCard",
  description:
    "Position sizing & risk calculator card. Shows account balance, " +
    "risk amount, position size, notional value, and margin required.",
  props: z.object({
    accountBalance: z.number(),
    riskPercent: z.number(),
    riskDollar: z.number(),
    entryPrice: z.number(),
    stopLoss: z.number(),
    leverage: z.string().describe("Leverage as a string, e.g. '10x'"),
    positionUnits: z.number(),
    notionalValueUsd: z.number(),
    marginRequiredUsd: z.number(),
    safeMaxLeverage: z.number().optional(),
  }),
  component: function RiskCalculatorCard({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as Record<string, number | string | undefined>
    const Row = ({
      label,
      value,
      highlight,
    }: {
      label: string
      value: string
      highlight?: boolean
    }) => (
      <div className="flex justify-between py-1 text-[11px] font-mono">
        <span className="text-muted-foreground">{label}</span>
        <span className={highlight ? "font-semibold text-emerald-500" : ""}>
          {value}
        </span>
      </div>
    )
    return (
      <Card className="gap-0 rounded-xl border-border p-4 shadow-sm">
        <div className="mb-2 text-xs font-mono text-muted-foreground">
          Risk Calculator
        </div>
        <Row label="Account Balance" value={`$${Number(p.accountBalance ?? 0).toLocaleString()}`} />
        <Row label="Risk %" value={`${Number(p.riskPercent ?? 0).toFixed(2)}%`} />
        <Row label="Risk $" value={`$${Number(p.riskDollar ?? 0).toFixed(2)}`} highlight />
        <div className="my-2 border-t border-border" />
        <Row label="Entry" value={`$${Number(p.entryPrice ?? 0).toLocaleString()}`} />
        <Row label="Stop Loss" value={`$${Number(p.stopLoss ?? 0).toLocaleString()}`} />
        <Row label="Leverage" value={String(p.leverage ?? "—")} />
        <Row label="Position Size" value={`${Number(p.positionUnits ?? 0).toFixed(4)} units`} highlight />
        <Row label="Notional" value={`$${Number(p.notionalValueUsd ?? 0).toLocaleString()}`} />
        <Row label="Margin Req." value={`$${Number(p.marginRequiredUsd ?? 0).toLocaleString()}`} />
        {p.safeMaxLeverage != null && (
          <Row label="Safe Max Lev." value={`${Number(p.safeMaxLeverage).toFixed(1)}x`} />
        )}
      </Card>
    )
  },
})

/**
 * Stat block — generic KPI tile for any single number + label.
 */
const StatBlock = defineComponent({
  name: "StatBlock",
  description:
    "Generic KPI tile. Use for a single number + label, e.g. open interest, " +
    "long/short ratio, market cap.",
  props: z.object({
    label: z.string(),
    value: z.string(),
    sub: z.string().optional(),
    accent: z
      .enum(["default", "emerald", "red", "amber"])
      .optional()
      .describe("Color tone"),
  }),
  component: function StatBlock({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as {
      label?: string
      value?: string
      sub?: string
      accent?: string
    }
    const accentClass =
      p.accent === "emerald"
        ? "text-emerald-500"
        : p.accent === "red"
        ? "text-red-500"
        : p.accent === "amber"
        ? "text-amber-500"
        : "text-foreground"
    return (
      <Card className="gap-0 rounded-lg border-border p-3 shadow-none">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {p.label ?? "—"}
        </div>
        <div className={`mt-1 font-mono text-lg font-semibold ${accentClass}`}>
          {p.value ?? "—"}
        </div>
        {p.sub && (
          <div className="mt-0.5 text-[10px] text-muted-foreground">{p.sub}</div>
        )}
      </Card>
    )
  },
})

/**
 * Action button — a clickable button that fires an OpenUI Lang action.
 * Use for re-running a tool call from the rendered card.
 */
const ActionButton = defineComponent({
  name: "ActionButton",
  description:
    "Clickable button. The onClick action can run a tool via " +
    "@Run, set state via @Set, or continue the conversation via @ToAssistant.",
  props: z.object({
    label: z.string().describe("Button text"),
    variant: z
      .enum(["default", "outline", "ghost", "destructive"])
      .optional()
      .describe("Visual style. Default: default."),
  }),
  component: function ActionButton({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as { label?: string; variant?: string }
    const triggerAction = useTriggerAction()
    const cls =
      p.variant === "outline"
        ? "border border-border bg-transparent text-foreground hover:bg-muted"
        : p.variant === "ghost"
        ? "bg-transparent text-foreground hover:bg-muted"
        : p.variant === "destructive"
        ? "bg-red-500 text-white hover:bg-red-600"
        : "bg-primary text-primary-foreground hover:bg-primary/90"
    return (
      <button
        type="button"
        className={`rounded-md px-3 py-1 text-xs font-medium transition ${cls}`}
        onClick={() => triggerAction("click")}
      >
        {p.label ?? "Click"}
      </button>
    )
  },
})

/**
 * Escape hatch for one-off custom visuals no domain component covers.
 * Renders in a sandboxed iframe (no `allow-same-origin`) — the generated
 * HTML/JS can't reach the parent page, cookies, or our app's state.
 */
const HtmlArtifact = defineComponent({
  name: "HtmlArtifact",
  description:
    "Renders arbitrary self-contained HTML (inline <style>/<script> allowed) " +
    "in a sandboxed iframe with no access to the parent page. Use ONLY for " +
    "one-off custom visuals no domain component covers — prefer the trading " +
    "cards above, and MarkdownFallback for plain text.",
  props: z.object({
    html: z.string().describe("Self-contained HTML document or fragment to render."),
    height: z.number().optional().describe("Iframe height in pixels. Default: 360."),
  }),
  component: function HtmlArtifact({ props }: ComponentRenderProps<unknown>) {
    const p = (props ?? {}) as { html?: string; height?: number }
    const html = p.html ?? ""
    return (
      // `key={html}` forces a fresh iframe per content change — setting
      // `srcDoc` on an existing iframe node is unreliable in Chrome (can
      // paint blank on first mount); a full remount always re-navigates.
      <iframe
        key={html}
        srcDoc={html}
        sandbox="allow-scripts"
        title="Generated content"
        className="w-full rounded-lg border border-border bg-white"
        style={{ height: `${p.height ?? 360}px` }}
      />
    )
  },
})

// ─── Assemble the library ─────────────────────────────────────────────

export const domainLibrary = createLibrary({
  root: "Stack",
  components: [
    // Layout
    Stack,
    Text,
    // Trading domain
    BinancePriceCard,
    OrderBookTable,
    TradeSetupCard,
    FundingRateCard,
    RiskCalculatorCard,
    StatBlock,
    // Interactivity
    ActionButton,
    // Escape hatch
    HtmlArtifact,
    // Fallback
    MarkdownFallback,
  ],
})

export default domainLibrary
