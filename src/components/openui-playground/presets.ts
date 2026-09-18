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
    code: `Stack(gap="md") {
  Text(content="BTCUSDT Market Overview" variant="heading")
  BinancePriceCard(symbol="BTCUSDT" price=94680.50 change24hPct=3.14 high24h=95240 low24h=93100 volume24h=1485000000)
  OrderBookTable(symbol="BTCUSDT" bids=[[94675, 1.42], [94670, 3.85], [94660, 5.12]] asks=[[94685, 2.10], [94690, 4.25], [94700, 6.80]])
  ActionButton(label="Refresh Market Data" variant="outline")
}`,
  },
  {
    id: "trade-setup",
    name: "ICT / SMC Setup",
    description: "TradeSetupCard + RiskCalculatorCard",
    code: `Stack(gap="md") {
  Text(content="Institutional Order Flow Setup" variant="heading")
  TradeSetupCard(symbol="BTCUSDT" direction="LONG" confluenceScore=5 entry=94200 stopLoss=93100 takeProfits=[95800, 97500] rrr=3.2 invalidation="Break of 4h demand swing low at $92,900")
  RiskCalculatorCard(accountBalance=25000 riskPercent=1.0 riskDollar=250 entryPrice=94200 stopLoss=93100 leverage="10x" positionUnits=0.2272 notionalValueUsd=21402 marginRequiredUsd=2140.20 safeMaxLeverage=12.5)
}`,
  },
  {
    id: "derivatives-funding",
    name: "Perp Funding & KPIs",
    description: "FundingRateCard + StatBlock",
    code: `Stack(gap="md") {
  Text(content="Derivatives Sentiment & Funding" variant="heading")
  FundingRateCard(symbol="BTCUSDT" currentRate=0.00018 nextFundingTime="2026-09-18T16:00:00Z" history=[0.00012, 0.00015, 0.00014, 0.00018])
  StatBlock(label="24h Long/Short Ratio" value="1.84" sub="Binance USD-M Top Accounts" accent="emerald")
}`,
  },
  {
    id: "risk-sizer",
    name: "Position Sizing",
    description: "RiskCalculatorCard + StatBlock",
    code: `Stack(gap="md") {
  Text(content="Capital Preservation & Position Sizing" variant="heading")
  RiskCalculatorCard(accountBalance=50000 riskPercent=1.5 riskDollar=750 entryPrice=94500 stopLoss=93200 leverage="5x" positionUnits=0.5769 notionalValueUsd=54517 marginRequiredUsd=10903.4 safeMaxLeverage=8.0)
  StatBlock(label="Max Portfolio Risk" value="1.50%" sub="Within 2% prop risk rule" accent="emerald")
}`,
  },
]
