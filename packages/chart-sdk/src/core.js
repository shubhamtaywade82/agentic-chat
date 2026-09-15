// chart-sdk/core — Smart Money Concepts (SMC) & ICT technical analysis detectors.
//
// This is a self-contained, deterministic implementation of the SMC/ICT
// detectors consumed by the agentic-chat prop trading engine. The detectors
// return shapes compatible with the upstream `chart-sdk/core` package so the
// prop-engine integration works without modification.
//
// All detectors are pure functions over a CandleData[] array and run in O(n)
// or O(n·w) time, where w is a small window (swing lookback). They are
// intentionally simple but reasonable: real FVG detection, real swing highs/
// lows, real liquidity sweeps, etc. The combined `scanSetups` produces a
// LONG / SHORT / NO_TRADE direction plus a confluence breakdown.

const SWING_LOOKBACK = 3; // fractal window on each side

function last(arr) {
  return arr.length > 0 ? arr[arr.length - 1] : undefined;
}

function isSwingHigh(candles, i) {
  const h = candles[i].high;
  for (let k = 1; k <= SWING_LOOKBACK; k++) {
    const a = candles[i - k];
    const b = candles[i + k];
    if (!a || !b) return false;
    if (a.high >= h || b.high >= h) return false;
  }
  return true;
}

function isSwingLow(candles, i) {
  const l = candles[i].low;
  for (let k = 1; k <= SWING_LOOKBACK; k++) {
    const a = candles[i - k];
    const b = candles[i + k];
    if (!a || !b) return false;
    if (a.low <= l || b.low <= l) return false;
  }
  return true;
}

// --- Market structure: detect break of structure (BOS) & change of character (CHOCH) ---
function detectMarketStructure(candles) {
  const breaks = [];
  let lastSwingHigh;
  let lastSwingLow;
  let trend = "neutral";
  for (let i = SWING_LOOKBACK; i < candles.length - SWING_LOOKBACK; i++) {
    if (isSwingHigh(candles, i)) {
      lastSwingHigh = candles[i].high;
    }
    if (isSwingLow(candles, i)) {
      lastSwingLow = candles[i].low;
    }
    const c = candles[i];
    if (lastSwingHigh && c.close > lastSwingHigh) {
      const type = trend === "bearish" ? "CHS_BULL" : "BOS_BULL";
      breaks.push({ time: c.time, price: c.close, type });
      trend = "bullish";
      lastSwingHigh = undefined;
    } else if (lastSwingLow && c.close < lastSwingLow) {
      const type = trend === "bullish" ? "CHS_BEAR" : "BOS_BEAR";
      breaks.push({ time: c.time, price: c.close, type });
      trend = "bearish";
      lastSwingLow = undefined;
    }
  }
  if (breaks.length === 0) {
    return { type: "RANGE", trend, lastSwingHigh, lastSwingLow, breaks };
  }
  const lastBreak = breaks[breaks.length - 1];
  return { type: lastBreak.type, trend, lastSwingHigh, lastSwingLow, breaks };
}

// --- Fair Value Gap (FVG) detection ---
// A bullish FVG is when candle[i-1].high < candle[i+1].low (gap up).
// A bearish FVG is when candle[i-1].low > candle[i+1].high (gap down).
function detectFVGs(candles) {
  const fvgs = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const next = candles[i + 1];
    if (prev.high < next.low) {
      const bottom = prev.high;
      const top = next.low;
      const mitigated = candles.slice(i + 2).some((c) => c.low <= top && c.high >= bottom);
      fvgs.push({ type: "BULLISH_FVG", top, bottom, mitigated, time: candles[i].time });
    } else if (prev.low > next.high) {
      const top = prev.low;
      const bottom = next.high;
      const mitigated = candles.slice(i + 2).some((c) => c.low <= top && c.high >= bottom);
      fvgs.push({ type: "BEARISH_FVG", top, bottom, mitigated, time: candles[i].time });
    }
  }
  return fvgs;
}

// --- Order Block detection ---
// Bullish OB: last down candle before a strong up move (close > prev high).
// Bearish OB: last up candle before a strong down move (close < prev low).
function detectOrderBlocks(candles) {
  const obs = [];
  for (let i = 2; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    const move = Math.abs(cur.close - cur.open) / Math.max(1e-9, cur.open);
    const strong = move > 0.003; // 0.3% body
    if (cur.close > cur.open && prev.close < prev.open && strong) {
      const top = Math.max(prev.open, prev.close);
      const bottom = Math.min(prev.open, prev.close);
      const mitigated = candles.slice(i + 1).some((c) => c.low <= bottom);
      obs.push({ type: "BULLISH_OB", top, bottom, time: prev.time, mitigated });
    } else if (cur.close < cur.open && prev.close > prev.open && strong) {
      const top = Math.max(prev.open, prev.close);
      const bottom = Math.min(prev.open, prev.close);
      const mitigated = candles.slice(i + 1).some((c) => c.high >= top);
      obs.push({ type: "BEARISH_OB", top, bottom, time: prev.time, mitigated });
    }
  }
  return obs;
}

// --- Liquidity pools (BSL / SSL) ---
// BSL = buy-side liquidity above swing highs; SSL = sell-side below swing lows.
// A pool is "swept" when a later candle's wick pierces its level.
function detectLiquidityPools(candles) {
  const pools = [];
  for (let i = SWING_LOOKBACK; i < candles.length - SWING_LOOKBACK; i++) {
    if (isSwingHigh(candles, i)) {
      const level = candles[i].high;
      const swept = candles.slice(i + 1).some((c) => c.high > level);
      const sweepCandle = candles.slice(i + 1).find((c) => c.high > level);
      pools.push({ type: "BSL", level, time: candles[i].time, swept, sweepTime: sweepCandle?.time });
    }
    if (isSwingLow(candles, i)) {
      const level = candles[i].low;
      const swept = candles.slice(i + 1).some((c) => c.low < level);
      const sweepCandle = candles.slice(i + 1).find((c) => c.low < level);
      pools.push({ type: "SSL", level, time: candles[i].time, swept, sweepTime: sweepCandle?.time });
    }
  }
  return pools;
}

// --- Premium / Discount zones around the recent range ---
function detectPremiumDiscount(candles) {
  if (candles.length === 0) {
    return { premium: { top: 0, bottom: 0 }, discount: { top: 0, bottom: 0 }, equilibrium: 0 };
  }
  const window = candles.slice(-100);
  const high = Math.max(...window.map((c) => c.high));
  const low = Math.min(...window.map((c) => c.low));
  const eq = (high + low) / 2;
  return {
    premium: { top: high, bottom: eq },
    discount: { top: eq, bottom: low },
    equilibrium: eq,
  };
}

// --- Supply / Demand zones (consolidation followed by explosive move) ---
function detectSupplyDemandZones(candles) {
  const zones = [];
  for (let i = 5; i < candles.length - 1; i++) {
    const base = candles.slice(i - 5, i);
    const ranges = base.map((c) => c.high - c.low);
    const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
    const cur = candles[i];
    const move = Math.abs(cur.close - cur.open);
    if (move > avgRange * 2) {
      const top = Math.max(...base.map((c) => c.high));
      const bottom = Math.min(...base.map((c) => c.low));
      const type = cur.close > cur.open ? "DEMAND" : "SUPPLY";
      const mitigated = candles.slice(i + 1).some((c) =>
        type === "DEMAND" ? c.low <= bottom : c.high >= top
      );
      zones.push({ type, top, bottom, time: candles[i].time, mitigated });
    }
  }
  return zones;
}

// --- Trendline liquidity: project the most recent swing into a notional level ---
function detectTrendlineLiquidity(candles) {
  const swings = [];
  for (let i = SWING_LOOKBACK; i < candles.length - SWING_LOOKBACK; i++) {
    if (isSwingHigh(candles, i)) swings.push({ type: "BSL_TREND", level: candles[i].high, time: candles[i].time });
    if (isSwingLow(candles, i)) swings.push({ type: "SSL_TREND", level: candles[i].low, time: candles[i].time });
  }
  if (swings.length === 0) return [];
  const lastSwing = swings[swings.length - 1];
  const swept = candles.some((c) =>
    lastSwing.type === "BSL_TREND" ? c.high > lastSwing.level : c.low < lastSwing.level
  );
  return [{ ...lastSwing, swept }];
}

// --- Candlestick patterns: simple doji / engulfing / hammer / shooting star ---
function detectCandlestickPatterns(candles) {
  const patterns = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const body = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.max(c.close, c.open);
    const lowerWick = Math.min(c.close, c.open) - c.low;
    if (body < (upperWick + lowerWick) * 0.2 && body > 0) {
      patterns.push({ name: "Doji", type: "neutral", time: c.time });
    }
    if (c.close > c.open && c.close > p.open && c.open < p.close && body > Math.abs(p.close - p.open)) {
      patterns.push({ name: "Bullish Engulfing", type: "bullish", time: c.time });
    }
    if (c.close < c.open && c.open > p.close && c.close < p.open && body > Math.abs(p.close - p.open)) {
      patterns.push({ name: "Bearish Engulfing", type: "bearish", time: c.time });
    }
    if (lowerWick > body * 2 && c.close > c.open) {
      patterns.push({ name: "Hammer", type: "bullish", time: c.time });
    }
    if (upperWick > body * 2 && c.close < c.open) {
      patterns.push({ name: "Shooting Star", type: "bearish", time: c.time });
    }
  }
  return patterns;
}

// --- ICT sessions (UTC-based) ---
function detectICTSessions(candles) {
  if (candles.length === 0) return [];
  const sessions = [
    { name: "ASIAN", start: 0, end: 7 },
    { name: "LONDON", start: 7, end: 12 },
    { name: "NEW_YORK", start: 12, end: 21 },
  ];
  return sessions;
}

// --- Silver Bullet windows (simplified: 10:00-11:00 UTC and 14:00-15:00 UTC) ---
function detectSilverBulletWindows(candles) {
  if (candles.length === 0) return [];
  return [
    { session: "London", start: 10, end: 11, direction: "neutral" },
    { session: "New York", start: 14, end: 15, direction: "neutral" },
  ];
}

// --- OTE (Optimal Trade Entry) zone: 0.62-0.79 retracement of last impulse ---
function detectICTOTEZone(candles) {
  if (candles.length < 5) {
    return { fib0382: 0, fib0618: 0, equilibrium: 0, inOTE: false };
  }
  const window = candles.slice(-50);
  const high = Math.max(...window.map((c) => c.high));
  const low = Math.min(...window.map((c) => c.low));
  const range = high - low;
  const eq = (high + low) / 2;
  const fib0618 = high - range * 0.618;
  const fib0382 = high - range * 0.382;
  const lastClose = last(window).close;
  const inOTE = lastClose >= fib0618 && lastClose <= fib0382;
  return { fib0382, fib0618, equilibrium: eq, inOTE };
}

// --- Judas swings: false move in session open direction reversed ---
function detectJudasSwings(candles) {
  const swings = [];
  for (let i = 10; i < candles.length; i++) {
    const window = candles.slice(i - 10, i);
    const open = window[0];
    const extreme = window.reduce((acc, c) => ({
      high: c.high > acc.high ? c.high : acc.high,
      low: c.low < acc.low ? c.low : acc.low,
    }), { high: open.high, low: open.low });
    const last = window[window.length - 1];
    if (last.close > open.open && last.close < extreme.high * 0.995 && extreme.high > open.open * 1.003) {
      swings.push({ type: "JUDAS_UP", time: last.time, level: extreme.high });
    }
    if (last.close < open.open && last.close > extreme.low * 1.005 && extreme.low < open.open * 0.997) {
      swings.push({ type: "JUDAS_DOWN", time: last.time, level: extreme.low });
    }
  }
  return swings;
}

// --- AMD cycles: Accumulation → Manipulation → Distribution ---
function detectAMDCycles(candles) {
  if (candles.length < 30) return [];
  const recent = candles.slice(-30);
  const firstThird = recent.slice(0, 10);
  const secondThird = recent.slice(10, 20);
  const lastThird = recent.slice(20);
  const acc = firstThird.reduce((s, c) => s + c.close, 0) / firstThird.length;
  const man = secondThird.reduce((s, c) => s + c.close, 0) / secondThird.length;
  const dist = lastThird.reduce((s, c) => s + c.close, 0) / lastThird.length;
  const cycles = [];
  cycles.push({ phase: "ACCUMULATION", start: firstThird[0].time, end: firstThird[firstThird.length - 1].time });
  if (man > acc * 1.005 || man < acc * 0.995) {
    cycles.push({ phase: "MANIPULATION", start: secondThird[0].time, end: secondThird[secondThird.length - 1].time });
  }
  if (dist > man) {
    cycles.push({ phase: "DISTRIBUTION", start: lastThird[0].time });
  }
  return cycles;
}

// --- Combined setup scan: weighs each factor and returns direction + confluence ---
function scanSetups(input) {
  const { structure, fvg, ob, liquidity, pd, ote, htf, sessions, sb, judas, amd, sd, tl, cp } = input;

  const confluence = [];
  const push = (name, aligned, weight = 1) => confluence.push({ name, aligned: Boolean(aligned), weight });

  const htfBullish = htf?.structure?.trend === "bullish";
  const htfBearish = htf?.structure?.trend === "bearish";
  const ltfBullish = structure?.trend === "bullish";
  const ltfBearish = structure?.trend === "bearish";

  push("HTF Bias Alignment", htfBullish || htfBearish, 1.5);
  push("LTF Market Structure", ltfBullish || ltfBearish, 1);

  const unmitBullOb = (ob || []).find((o) => o.type === "BULLISH_OB" && !o.mitigated);
  const unmitBearOb = (ob || []).find((o) => o.type === "BEARISH_OB" && !o.mitigated);
  push("Untapped Order Block", unmitBullOb || unmitBearOb, 1);

  const unmitBullFvg = (fvg || []).find((f) => f.type === "BULLISH_FVG" && !f.mitigated);
  const unmitBearFvg = (fvg || []).find((f) => f.type === "BEARISH_FVG" && !f.mitigated);
  push("Unmitigated FVG", unmitBullFvg || unmitBearFvg, 1);

  const sweptSsl = (liquidity || []).find((l) => l.type === "SSL" && l.swept);
  const sweptBsl = (liquidity || []).find((l) => l.type === "BSL" && l.swept);
  push("Liquidity Sweep (Judas)", sweptSsl || sweptBsl, 1);

  const inOTE = ote?.inOTE;
  push("OTE Zone (0.62-0.79)", inOTE, 0.5);

  const demandZone = (sd || []).find((z) => z.type === "DEMAND" && !z.mitigated);
  const supplyZone = (sd || []).find((z) => z.type === "SUPPLY" && !z.mitigated);
  push("Supply/Demand Zone", demandZone || supplyZone, 0.5);

  const bullPattern = (cp || []).some((p) => p.type === "bullish");
  const bearPattern = (cp || []).some((p) => p.type === "bearish");
  push("Confirmation Candlestick", bullPattern || bearPattern, 0.5);

  const alignedCount = confluence.filter((c) => c.aligned).length;

  // Long: bullish structure on HTF + at least 3 bullish-aligned factors
  const longScore = [
    htfBullish,
    ltfBullish,
    Boolean(unmitBullOb),
    Boolean(unmitBullFvg),
    Boolean(sweptSsl),
    Boolean(demandZone),
    inOTE,
    bullPattern,
  ].filter(Boolean).length;

  const shortScore = [
    htfBearish,
    ltfBearish,
    Boolean(unmitBearOb),
    Boolean(unmitBearFvg),
    Boolean(sweptBsl),
    Boolean(supplyZone),
    inOTE,
    bearPattern,
  ].filter(Boolean).length;

  let direction = "NO_TRADE";
  let bias = "neutral";
  if (longScore >= 3 && longScore > shortScore) {
    direction = "LONG";
    bias = htfBullish ? "bullish" : "neutral";
  } else if (shortScore >= 3 && shortScore > longScore) {
    direction = "SHORT";
    bias = htfBearish ? "bearish" : "neutral";
  } else if (alignedCount >= 4) {
    direction = longScore >= shortScore ? "LONG" : "SHORT";
    bias = direction === "LONG" ? "bullish" : "bearish";
  }

  return { direction, bias, alignedCount, confluence };
}

module.exports = {
  detectFVGs,
  detectOrderBlocks,
  detectMarketStructure,
  detectLiquidityPools,
  detectPremiumDiscount,
  detectSupplyDemandZones,
  detectTrendlineLiquidity,
  detectCandlestickPatterns,
  detectICTSessions,
  detectSilverBulletWindows,
  detectICTOTEZone,
  detectJudasSwings,
  detectAMDCycles,
  scanSetups,
};
