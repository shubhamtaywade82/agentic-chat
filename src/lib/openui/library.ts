/**
 * OpenUI integration sketches (Pattern B + D).
 *
 * This file is a SKETCH — it documents the intended shape of the domain
 * component library that the OpenUI `<Renderer>` will use to render
 * assistant final answers as interactive UIs instead of Markdown.
 *
 * To activate:
 *   1. `npm install @openuidev/react-lang @openuidev/react-ui zod`
 *   2. Uncomment the imports below.
 *   3. Import `domainLibrary` from `agent-message.tsx` and pass it to
 *      `<Renderer library={...}>` when `looksLikeOpenUILang(content)` is true.
 *
 * See docs/openui-integration.md §5.2–5.4 for the full design.
 */

// import { createLibrary, defineComponent } from "@openuidev/react-lang"
// import { openuiLibrary } from "@openuidev/react-ui"
// import { z } from "zod"

/**
 * Example domain component: a live crypto price ticker card.
 *
 * The LLM emits this in OpenUI Lang as:
 *
 *   BinancePriceCard(symbol: "BTCUSDT", price: 67000.5, change24hPct: 2.3)
 *
 * The Renderer parses that and mounts the React component below with the
 * typed props. Zod validates the props at parse time; malformed values are
 * surfaced via `<Renderer onError>`.
 */
/*
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
  }),
  component: function BinancePriceCard({ props }) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs text-muted-foreground">{props.symbol}</div>
        <div className="text-2xl font-mono">
          ${props.price?.toFixed(2) ?? "—"}
        </div>
        {props.change24hPct != null && (
          <div
            className={
              props.change24hPct >= 0 ? "text-emerald-500" : "text-red-500"
            }
          >
            {props.change24hPct >= 0 ? "+" : ""}
            {props.change24hPct.toFixed(2)}% 24h
          </div>
        )}
      </div>
    )
  },
})
*/

/**
 * OrderBookTable — bids/asks depth table.
 *
 *   OrderBookTable(symbol: "BTCUSDT", bids: [[67000.1, 1.2], ...], asks: ...)
 */
/*
const OrderBookTable = defineComponent({
  name: "OrderBookTable",
  description: "Order book depth table for a Binance USD-M pair.",
  props: z.object({
    symbol: z.string(),
    bids: z.array(z.tuple([z.number(), z.number()])).max(20),
    asks: z.array(z.tuple([z.number(), z.number()])).max(20),
  }),
  component: function OrderBookTable({ props }) {
    return (
      <table className="w-full text-xs font-mono">
        <thead>
          <tr>
            <th>Price</th><th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {props.asks.map(([p, q], i) => (
            <tr key={`a${i}`} className="text-red-500">
              <td>{p}</td><td>{q}</td>
            </tr>
          ))}
          {props.bids.map(([p, q], i) => (
            <tr key={`b${i}`} className="text-emerald-500">
              <td>{p}</td><td>{q}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  },
})
*/

/**
 * MarkdownFallback — renders raw Markdown inside a card. Used when the LLM
 * emits OpenUI Lang whose root component is unknown to our library.
 */
/*
const MarkdownFallback = defineComponent({
  name: "MarkdownFallback",
  description: "Fallback renderer for Markdown content.",
  props: z.object({ content: z.string() }),
  component: function MarkdownFallback({ props }) {
    // Reuse the existing markdown renderer:
    //   <MarkdownView content={props.content} />
    return <div className="prose dark:prose-invert">{props.content}</div>
  },
})
*/

/**
 * The assembled domain library. We extend OpenUI's built-in `openuiLibrary`
 * (which ships charts, forms, tables, layouts, etc.) with our trading-
 * domain components.
 */
/*
export const domainLibrary = createLibrary({
  root: openuiLibrary.root ?? "Stack",
  componentGroups: openuiLibrary.componentGroups,
  components: [
    ...Object.values(openuiLibrary.components),
    BinancePriceCard,
    OrderBookTable,
    MarkdownFallback,
    // Phase 2 additions: TradeSetupCard, FundingRateChart, RiskCalculatorCard,
    // DhanPositionRow, PropSetupList, etc.
  ],
})
*/

// Until `@openuidev/*` is installed, export a placeholder so other sketch
// files can import this without breaking the build.
export const domainLibrary = null as unknown
export default domainLibrary
