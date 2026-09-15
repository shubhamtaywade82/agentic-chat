// Type declarations for binance-client-ts local stub package.
// These mirror the runtime shape implemented in src/index.js.

export interface BinanceClientOptions {
  apiKey?: string;
  apiSecret?: string;
  testnet?: boolean;
}

export interface TickerPrice {
  symbol: string;
  price: number;
  time?: number;
}

export interface Ticker24hr {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  weightedAvgPrice: number;
  prevClosePrice: number;
  lastPrice: number;
  lastQty: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  openTime: number;
  closeTime: number;
}

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
}

export interface DepthLevel {
  price: number;
  qty: number;
}

export interface DepthData {
  lastUpdateId: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
}

export interface FundingRateEntry {
  symbol: string;
  fundingRate: number;
  fundingTime: number;
  markPrice?: number;
}

export interface OpenInterestEntry {
  symbol: string;
  openInterest: number;
  time?: number;
}

export interface LongShortRatioEntry {
  symbol: string;
  longShortRatio: number;
  longAccount: number;
  shortAccount: number;
  timestamp?: number;
}

export interface PositionRiskEntry {
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  unRealizedProfit: number;
  liquidationPrice?: number;
  leverage: string;
  maxNotionalValue: number;
  positionSide: string;
}

export interface FuturesMarketApi {
  tickerPrice(symbol: string): Promise<TickerPrice>;
  ticker24hr(symbol: string): Promise<Ticker24hr>;
  klines(symbol: string, interval: string, opts?: { limit?: number }): Promise<Kline[]>;
  depth(symbol: string, limit: number): Promise<DepthData>;
}

export interface FuturesDataApi {
  fundingRateHistory(symbol: string, opts?: { limit?: number }): Promise<FundingRateEntry[]>;
  openInterest(symbol: string): Promise<OpenInterestEntry>;
  globalLongShortAccountRatio(symbol: string, period: string, limit: number): Promise<LongShortRatioEntry[]>;
}

export interface FuturesAccountApi {
  positionRisk(): Promise<PositionRiskEntry[]>;
}

export interface FuturesApi {
  market: FuturesMarketApi;
  data: FuturesDataApi;
  account: FuturesAccountApi;
}

export class BinanceClient {
  constructor(opts?: BinanceClientOptions);
  apiKey?: string;
  apiSecret?: string;
  testnet: boolean;
  restBase: string;
  futures: FuturesApi;
}
