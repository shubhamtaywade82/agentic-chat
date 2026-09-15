// chart-sdk type declarations.

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type MarketStructureType =
  | "BOS_BULL"
  | "BOS_BEAR"
  | "CHS_BULL"
  | "CHS_BEAR"
  | "RANGE";

export interface MarketStructure {
  type: MarketStructureType;
  trend: "bullish" | "bearish" | "neutral";
  lastSwingHigh?: number;
  lastSwingLow?: number;
  breaks: { time: number; price: number; type: MarketStructureType }[];
}

export interface FairValueGap {
  type: "BULLISH_FVG" | "BEARISH_FVG";
  top: number;
  bottom: number;
  mitigated: boolean;
  time: number;
}

export type OrderBlockType = "BULLISH_OB" | "BEARISH_OB";

export interface OrderBlock {
  type: OrderBlockType;
  top: number;
  bottom: number;
  time: number;
  mitigated: boolean;
}

export interface LiquidityPool {
  type: "BSL" | "SSL";
  level: number;
  time: number;
  swept: boolean;
  sweepTime?: number;
}

export interface PremiumDiscountZone {
  premium: { top: number; bottom: number };
  discount: { top: number; bottom: number };
  equilibrium: number;
}

export interface SupplyDemandZone {
  type: "DEMAND" | "SUPPLY";
  top: number;
  bottom: number;
  time: number;
  mitigated: boolean;
}

export interface TrendlineLiquidity {
  type: "BSL_TREND" | "SSL_TREND";
  level: number;
  time: number;
  swept: boolean;
}

export interface CandlestickPattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  time: number;
}

export interface ICTSession {
  name: "ASIAN" | "LONDON" | "NEW_YORK";
  start: number;
  end: number;
}

export interface SilverBulletWindow {
  session: string;
  start: number;
  end: number;
  direction: "bullish" | "bearish" | "neutral";
}

export interface OTEZone {
  fib0382: number;
  fib0618: number;
  equilibrium: number;
  inOTE: boolean;
}

export interface JudasSwing {
  type: "JUDAS_UP" | "JUDAS_DOWN";
  time: number;
  level: number;
}

export interface AMDCycle {
  phase: "ACCUMULATION" | "MANIPULATION" | "DISTRIBUTION";
  start: number;
  end?: number;
}

export interface HtfBias {
  tfLabel: string;
  structure: MarketStructure;
  amd: AMDCycle[];
  liquidity: LiquidityPool[];
  judas: JudasSwing[];
}

export interface ConfluenceFactor {
  name: string;
  aligned: boolean;
  weight: number;
}

export interface ScanResult {
  direction: "LONG" | "SHORT" | "NO_TRADE";
  bias: "bullish" | "bearish" | "neutral";
  alignedCount: number;
  confluence: ConfluenceFactor[];
}
