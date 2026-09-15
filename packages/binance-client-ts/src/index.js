// binance-client-ts — local lightweight Binance USD-M futures client.
//
// This package implements only the surface area used by the agentic-chat app:
//   - new BinanceClient({ apiKey?, apiSecret?, testnet? })
//   - client.futures.market.tickerPrice(symbol)
//   - client.futures.market.ticker24hr(symbol)
//   - client.futures.market.klines(symbol, interval, { limit })
//   - client.futures.market.depth(symbol, limit)
//   - client.futures.data.fundingRateHistory(symbol, { limit })
//   - client.futures.data.openInterest(symbol)
//   - client.futures.data.globalLongShortAccountRatio(symbol, period, limit)
//   - client.futures.account.positionRisk()
//
// Public market data uses the public REST endpoints on fapi.binance.com (or
// testnet.binancefuture.com when `testnet: true`). Authenticated calls
// (positionRisk) require apiKey/apiSecret and are signed with HMAC-SHA256.

const crypto = require("crypto");

const PUBLIC_BASE = "https://fapi.binance.com";
const TESTNET_BASE = "https://testnet.binancefuture.com";

function buildQuery(params) {
  return Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function getJson(url, headers, signedQuery) {
  const finalUrl = signedQuery ? `${url}?${signedQuery}` : url;
  const res = await fetch(finalUrl, { method: "GET", headers: headers || {} });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Binance API ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

function sign(secret, query) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

class FuturesMarket {
  constructor(client) {
    this.client = client;
  }

  async serverTime() {
    const data = await getJson(`${this.client.restBase}/fapi/v1/time`);
    return { serverTime: data.serverTime };
  }

  async tickerPrice(symbol) {
    const data = await getJson(`${this.client.restBase}/fapi/v1/ticker/price`, undefined, buildQuery({ symbol }));
    return { symbol: data.symbol, price: parseFloat(data.price), time: data.time };
  }

  async ticker24hr(symbol) {
    const data = await getJson(`${this.client.restBase}/fapi/v1/ticker/24hr`, undefined, buildQuery({ symbol }));
    return {
      symbol: data.symbol,
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      weightedAvgPrice: parseFloat(data.weightedAvgPrice),
      prevClosePrice: parseFloat(data.prevClosePrice),
      lastPrice: parseFloat(data.lastPrice),
      lastQty: parseFloat(data.lastQty),
      openPrice: parseFloat(data.openPrice),
      highPrice: parseFloat(data.highPrice),
      lowPrice: parseFloat(data.lowPrice),
      volume: parseFloat(data.volume),
      quoteVolume: parseFloat(data.quoteVolume),
      openTime: data.openTime,
      closeTime: data.closeTime,
    };
  }

  async klines(symbol, interval, opts) {
    const limit = (opts && opts.limit) || 100;
    const rows = await getJson(
      `${this.client.restBase}/fapi/v1/klines`,
      undefined,
      buildQuery({ symbol, interval, limit })
    );
    // Binance returns each kline as an array:
    // [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore]
    return rows.map((k) => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
      quoteVolume: parseFloat(k[7]),
      trades: k[8],
    }));
  }

  async depth(symbol, limit) {
    const data = await getJson(
      `${this.client.restBase}/fapi/v1/depth`,
      undefined,
      buildQuery({ symbol, limit })
    );
    return {
      lastUpdateId: data.lastUpdateId,
      bids: (data.bids || []).map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
      asks: (data.asks || []).map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) })),
    };
  }
}

class FuturesData {
  constructor(client) {
    this.client = client;
  }

  async fundingRateHistory(symbol, opts) {
    const limit = (opts && opts.limit) || 100;
    const rows = await getJson(
      `${this.client.restBase}/futures/data/fundingRateHistory`,
      undefined,
      buildQuery({ symbol, limit })
    );
    return (rows || []).map((r) => ({
      symbol: r.symbol,
      fundingRate: parseFloat(r.fundingRate),
      fundingTime: r.fundingTime,
      markPrice: r.markPrice ? parseFloat(r.markPrice) : undefined,
    }));
  }

  async openInterest(symbol) {
    const data = await getJson(
      `${this.client.restBase}/fapi/v1/openInterest`,
      undefined,
      buildQuery({ symbol })
    );
    return { symbol, openInterest: parseFloat(data.openInterest), time: data.time };
  }

  async globalLongShortAccountRatio(symbol, period, limit) {
    const rows = await getJson(
      `${this.client.restBase}/futures/data/globalLongShortAccountRatio`,
      undefined,
      buildQuery({ symbol, period, limit: limit || 30 })
    );
    return (rows || []).map((r) => ({
      symbol: r.symbol,
      longShortRatio: parseFloat(r.longShortRatio),
      longAccount: parseFloat(r.longAccount),
      shortAccount: parseFloat(r.shortAccount),
      timestamp: r.timestamp,
    }));
  }
}

class FuturesAccount {
  constructor(client) {
    this.client = client;
  }

  // Authenticated: requires apiKey + apiSecret
  async positionRisk() {
    if (!this.client.apiKey || !this.client.apiSecret) {
      throw new Error("positionRisk requires apiKey and apiSecret");
    }
    const ts = Date.now();
    const params = { timestamp: ts, recvWindow: 5000 };
    const query = buildQuery(params);
    const signature = sign(this.client.apiSecret, query);
    const signedQuery = `${query}&signature=${signature}`;
    const headers = { "X-MBX-APIKEY": this.client.apiKey };
    const rows = await getJson(`${this.client.restBase}/fapi/v2/positionRisk`, headers, signedQuery);
    return (rows || []).map((r) => ({
      symbol: r.symbol,
      positionAmt: parseFloat(r.positionAmt),
      entryPrice: parseFloat(r.entryPrice),
      markPrice: parseFloat(r.markPrice),
      unRealizedProfit: parseFloat(r.unRealizedProfit),
      liquidationPrice: r.liquidationPrice ? parseFloat(r.liquidationPrice) : undefined,
      leverage: r.leverage,
      maxNotionalValue: parseFloat(r.maxNotionalValue),
      positionSide: r.positionSide,
    }));
  }
}

class FuturesNamespace {
  constructor(client) {
    this.client = client;
    this.market = new FuturesMarket(client);
    this.data = new FuturesData(client);
    this.account = new FuturesAccount(client);
  }
}

class BinanceClient {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || undefined;
    this.apiSecret = opts.apiSecret || undefined;
    this.testnet = Boolean(opts.testnet);
    this.restBase = this.testnet ? TESTNET_BASE : PUBLIC_BASE;
    this.futures = new FuturesNamespace(this);
  }
}

module.exports = { BinanceClient };
module.exports.BinanceClient = BinanceClient;
module.exports.default = { BinanceClient };
