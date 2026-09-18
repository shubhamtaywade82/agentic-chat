/**
 * Server-safe OpenUI component spec — for prompt generation only.
 *
 * This file is imported by `prompt.ts`, which is in turn imported by the
 * server-side `/api/agent` route handler. It MUST NOT import React or any
 * React-dependent module (including `@openuidev/react-lang` or
 * `react-syntax-highlighter`).
 *
 * We use `createLibrary` + `defineComponent` from `@openuidev/lang-core`
 * (framework-agnostic) with stub components that have NO React `component`
 * field — just `name`, `description`, and `props` (the Zod schema). The
 * spec generated from this is identical to what the client-side
 * `library.tsx` would produce, because `generateSystemPrompt` only reads
 * the spec/schema, not the React components.
 *
 * The actual React implementations live in `library.tsx` and are only
 * loaded client-side by `openui-answer.tsx`.
 *
 * KEEP THIS FILE IN SYNC WITH `library.tsx`. Every component here must
 * have the same name, description, and props shape as its React twin.
 */

import {
  createLibrary,
  defineComponent,
} from "@openuidev/lang-core"
import { z } from "zod"

// ─── Root layout components ───────────────────────────────────────────

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
  // `component` field omitted — server-safe stub. The React impl lives in
  // library.tsx.
  component: null as never,
})

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
  component: null as never,
})

const MarkdownFallback = defineComponent({
  name: "MarkdownFallback",
  description:
    "Fallback renderer for Markdown content. Use ONLY when no domain " +
    "component fits — prefer BinancePriceCard, OrderBookTable, etc.",
  props: z.object({
    content: z.string().describe("Markdown source to display as plain text."),
  }),
  component: null as never,
})

// ─── Trading domain components ────────────────────────────────────────

const BinancePriceCard = defineComponent({
  name: "BinancePriceCard",
  description:
    "Live crypto price ticker card. Use for any 'show me the price of X' " +
    "response where X is a Binance USD-M pair (BTCUSDT, SOLUSDT, etc.).",
  props: z.object({
    symbol: z.string().describe("Uppercase Binance USD-M pair, e.g. BTCUSDT"),
    price: z.number().optional().describe("Last traded price (if known at generation time)"),
    change24hPct: z.number().optional().describe("24h price change percent"),
    high24h: z.number().optional().describe("24h high"),
    low24h: z.number().optional().describe("24h low"),
    volume24h: z.number().optional().describe("24h quote volume"),
  }),
  component: null as never,
})

const OrderBookTable = defineComponent({
  name: "OrderBookTable",
  description:
    "Order book depth table for a Binance USD-M pair. Shows top N bids " +
    "and asks with price + quantity.",
  props: z.object({
    symbol: z.string().describe("Trading pair, e.g. BTCUSDT"),
    bids: z.array(z.tuple([z.number(), z.number()])).max(20).describe("Top bids as [[price, qty], …]"),
    asks: z.array(z.tuple([z.number(), z.number()])).max(20).describe("Top asks as [[price, qty], …]"),
  }),
  component: null as never,
})

const TradeSetupCard = defineComponent({
  name: "TradeSetupCard",
  description:
    "Trade setup card showing direction, confluence score, entry, SL, " +
    "and TP1/2/3. Use for prop_scan_setups or prop_evaluate_pair results.",
  props: z.object({
    symbol: z.string(),
    direction: z.enum(["LONG", "SHORT", "NO_TRADE"]).describe("Setup direction. NO_TRADE means no actionable setup."),
    confluenceScore: z.number().int().min(0).max(6).optional().describe("Number of confluence factors (0–6)."),
    entry: z.number().optional().describe("Entry price"),
    stopLoss: z.number().optional().describe("Stop-loss price"),
    takeProfits: z.array(z.number()).max(3).optional().describe("TP1, TP2, TP3 prices"),
    rrr: z.number().optional().describe("Risk-to-reward ratio"),
    invalidation: z.string().optional().describe("What invalidates the setup"),
  }),
  component: null as never,
})

const FundingRateCard = defineComponent({
  name: "FundingRateCard",
  description:
    "Funding rate card for a Binance USD-M perpetual. Shows current rate, " +
    "next funding time, and a 5-rate history sparkline.",
  props: z.object({
    symbol: z.string(),
    currentRate: z.number().optional().describe("Current funding rate as a fraction (0.0001 = 0.01%)"),
    nextFundingTime: z.string().optional().describe("ISO 8601 timestamp of next funding"),
    history: z.array(z.number()).max(10).optional().describe("Recent funding rates, oldest first"),
  }),
  component: null as never,
})

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
  component: null as never,
})

const StatBlock = defineComponent({
  name: "StatBlock",
  description:
    "Generic KPI tile. Use for a single number + label, e.g. open interest, " +
    "long/short ratio, market cap.",
  props: z.object({
    label: z.string(),
    value: z.string(),
    sub: z.string().optional(),
    accent: z.enum(["default", "emerald", "red", "amber"]).optional().describe("Color tone"),
  }),
  component: null as never,
})

const ActionButton = defineComponent({
  name: "ActionButton",
  description:
    "Clickable button. The onClick action can run a tool via " +
    "@Run, set state via @Set, or continue the conversation via @ToAssistant.",
  props: z.object({
    label: z.string().describe("Button text"),
    variant: z.enum(["default", "outline", "ghost", "destructive"]).optional().describe("Visual style. Default: default."),
  }),
  component: null as never,
})

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
  component: null as never,
})

// ─── Assemble the spec library ────────────────────────────────────────

/**
 * Server-safe library — for system-prompt generation only.
 * The React implementations live in `library.tsx`.
 */
export const domainLibrarySpec = createLibrary({
  root: "Stack",
  components: [
    Stack,
    Text,
    BinancePriceCard,
    OrderBookTable,
    TradeSetupCard,
    FundingRateCard,
    RiskCalculatorCard,
    StatBlock,
    ActionButton,
    HtmlArtifact,
    MarkdownFallback,
  ],
})

export default domainLibrarySpec
