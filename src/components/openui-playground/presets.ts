export interface OpenUIPreset {
  id: string
  name: string
  description: string
  code: string
}

export const OPENUI_PRESETS: OpenUIPreset[] = [
  {
    id: "market-overview",
    name: "Live Ticker & Depth",
    description: "BinancePriceCard + OrderBookTable + ActionButton",
    code: `root = Stack("md", [
  Text("BTCUSDT Market Overview", "heading"),
  BinancePriceCard("BTCUSDT", 94680.50, 3.14, 95240, 93100, 1485000000),
  OrderBookTable("BTCUSDT", [[94675, 1.42], [94670, 3.85], [94660, 5.12]], [[94685, 2.10], [94690, 4.25], [94700, 6.80]]),
  ActionButton("Refresh Market Data", "outline")
])`,
  },
  {
    id: "trade-setup",
    name: "ICT / SMC Setup",
    description: "TradeSetupCard + RiskCalculatorCard",
    code: `root = Stack("md", [
  Text("Institutional Order Flow Setup", "heading"),
  TradeSetupCard("BTCUSDT", "LONG", 5, 94200, 93100, [95800, 97500], 3.2, "Break of 4h demand swing low at $92,900"),
  RiskCalculatorCard(25000, 1.0, 250, 94200, 93100, "10x", 0.2272, 21402, 2140.20, 12.5)
])`,
  },
  {
    id: "derivatives-funding",
    name: "Perp Funding & KPIs",
    description: "FundingRateCard + StatBlock",
    code: `root = Stack("md", [
  Text("Derivatives Sentiment & Funding", "heading"),
  FundingRateCard("BTCUSDT", 0.00018, "2026-09-18T16:00:00Z", [0.00012, 0.00015, 0.00014, 0.00018]),
  StatBlock("24h Long/Short Ratio", "1.84", "Binance USD-M Top Accounts", "emerald")
])`,
  },
  {
    id: "risk-sizer",
    name: "Position Sizing",
    description: "RiskCalculatorCard + StatBlock",
    code: `root = Stack("md", [
  Text("Capital Preservation & Position Sizing", "heading"),
  RiskCalculatorCard(50000, 1.5, 750, 94500, 93200, "5x", 0.5769, 54517, 10903.4, 8.0),
  StatBlock("Max Portfolio Risk", "1.50%", "Within 2% prop risk rule", "emerald")
])`,
  },
]
