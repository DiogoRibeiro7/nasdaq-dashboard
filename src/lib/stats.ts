/**
 * Stock statistics computation module.
 *
 * Provides functions to calculate risk and return metrics from
 * historical stock price data.
 */

import type { StockTimeSeriesPoint } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computed statistics for a stock over a given time period.
 */
export type StockStats = {
  /** Most recent closing price */
  lastClose: number;
  /** Return over the last ~21 trading days (1 month), or null if insufficient data */
  oneMonthReturn: number | null;
  /** Return over the last ~63 trading days (3 months), or null if insufficient data */
  threeMonthReturn: number | null;
  /** Annualized volatility (standard deviation of log returns), or null if insufficient data */
  annualizedVolatility: number | null;
};

/**
 * Correlation matrix for multiple stock symbols.
 */
export type CorrelationMatrix = {
  /** Array of stock symbols in the matrix */
  symbols: string[];
  /** 2D array where values[i][j] is the correlation between symbols[i] and symbols[j] */
  values: number[][];
};

/**
 * A single point of rolling volatility data.
 */
export type RollingVolatilityPoint = {
  /** Date of the observation */
  date: string;
  /** Annualized volatility calculated over the rolling window */
  vol: number;
};

/**
 * A single point of rolling return data.
 */
export type RollingReturnPoint = {
  /** Date of the observation */
  date: string;
  /** Simple return over the rolling window */
  ret: number;
};

/**
 * A single point of drawdown data.
 */
export type DrawdownPoint = {
  /** Date of the observation */
  date: string;
  /** Current drawdown from peak (negative or zero) */
  drawdown: number;
  /** Maximum drawdown observed up to this point */
  peakToTrough: number;
};

/**
 * A single daily log return data point.
 */
export type DailyLogReturn = {
  /** Date of the return */
  date: string;
  /** Log return for the day: ln(P_t / P_{t-1}) */
  r: number;
};

/**
 * A single bin in a return distribution histogram.
 */
export type ReturnDistributionBin = {
  /** Center value of the bin (log return) */
  binCenter: number;
  /** Number of observations in this bin */
  count: number;
};

/**
 * Higher moment statistics of a return distribution.
 */
export type HigherMoments = {
  /** Arithmetic mean of returns */
  mean: number;
  /** Sample standard deviation of returns */
  std: number;
  /** Skewness (third standardized moment) - measures asymmetry */
  skewness: number;
  /** Excess kurtosis (fourth standardized moment - 3) - measures tail thickness */
  kurtosis: number;
};

/**
 * Input format for correlation matrix calculation.
 */
export type CorrelationInput = {
  date: string;
  close: number;
};

/**
 * A single point of rolling correlation data.
 */
export type RollingCorrelationPoint = {
  /** Date of the observation */
  date: string;
  /** Correlation coefficient for the rolling window */
  corr: number;
};

/**
 * CAPM regression statistics between an asset and benchmark.
 */
export type CapmStats = {
  /** Beta coefficient (sensitivity to benchmark) */
  beta: number | null;
  /** Daily alpha (intercept) */
  alphaDaily: number | null;
  /** Annualized alpha (daily alpha × 252 trading days) */
  alphaAnnual: number | null;
  /** Coefficient of determination (R²) */
  r2: number | null;
};

/**
 * A price gap event detected in the time series.
 */
export type GapEvent = {
  /** Date of the gap */
  date: string;
  /** Gap percentage (open vs previous close) */
  gapPct: number;
  /** Opening price on gap day */
  open: number;
  /** Previous day's closing price */
  prevClose: number;
};

/**
 * A volume spike event detected in the time series.
 */
export type VolumeSpikeEvent = {
  /** Date of the spike */
  date: string;
  /** Z-score of the volume */
  zScore: number;
  /** Actual volume on spike day */
  volume: number;
  /** Average volume for comparison */
  avgVolume: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Approximate trading days per year for annualization */
const TRADING_DAYS_PER_YEAR = 252;

/** Approximate trading days per month */
const TRADING_DAYS_PER_MONTH = 21;

/** Approximate trading days per quarter */
const TRADING_DAYS_PER_QUARTER = 63;

/** Minimum number of data points required for volatility calculation */
const MIN_POINTS_FOR_VOLATILITY = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a price value is usable for calculations.
 * Returns true if the value is a finite positive number.
 */
function isValidPrice(price: number): boolean {
  return Number.isFinite(price) && price > 0;
}

/**
 * Extracts valid closing prices from a time series.
 * Filters out any NaN, Infinity, zero, or negative values.
 *
 * @param series - Array of stock data points
 * @returns Array of valid closing prices in the same order
 */
function extractValidCloses(series: StockTimeSeriesPoint[]): number[] {
  return series.map((s) => s.close).filter(isValidPrice);
}

/**
 * Computes log returns from an array of prices.
 * Log returns are used for volatility calculations as they are
 * time-additive and approximately normally distributed.
 *
 * @param prices - Array of prices (must have at least 2 elements)
 * @returns Array of log returns (length = prices.length - 1)
 */
function computeLogReturns(prices: number[]): number[] {
  const returns: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const logReturn = Math.log(prices[i] / prices[i - 1]);

    // Skip invalid log returns (can happen with bad data)
    if (Number.isFinite(logReturn)) {
      returns.push(logReturn);
    }
  }

  return returns;
}

/**
 * Computes the sample standard deviation of an array of numbers.
 * Uses Bessel's correction (n-1 denominator) for unbiased estimation.
 *
 * @param values - Array of numbers (must have at least 2 elements)
 * @returns Sample standard deviation, or NaN if insufficient data
 */
function sampleStdDev(values: number[]): number {
  if (values.length < 2) {
    return NaN;
  }

  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (n - 1);

  return Math.sqrt(variance);
}

/**
 * Computes simple return between two price points.
 *
 * @param currentPrice - Current/ending price
 * @param basePrice - Base/starting price
 * @returns Simple return as a decimal (e.g., 0.10 for 10%)
 */
function simpleReturn(currentPrice: number, basePrice: number): number | null {
  if (!isValidPrice(currentPrice) || !isValidPrice(basePrice)) {
    return null;
  }
  return currentPrice / basePrice - 1;
}

/**
 * Validates that a volume value is usable for calculations.
 * Returns true if the value is a finite non-negative number.
 */
function isValidVolume(volume: number): boolean {
  return Number.isFinite(volume) && volume >= 0;
}

/**
 * Computes the population standard deviation for an array of values.
 * Uses n in the denominator to capture dispersion for anomaly detection.
 */
function populationStdDev(values: number[]): number {
  if (values.length === 0) {
    return NaN;
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects price gap events where the opening price deviates significantly
 * from the previous day's close.
 *
 * gapPct = (open_today / close_yesterday) - 1
 *
 * @param series - Daily OHLCV data sorted by date ascending
 * @param thresholdPct - Minimum absolute gap percentage to flag (e.g., 0.02 for 2%)
 * @returns Array of detected gap events with dates and gap percentages
 */
export function detectGaps(
  series: StockTimeSeriesPoint[],
  thresholdPct: number,
): GapEvent[] {
  if (series.length < 2 || thresholdPct <= 0) {
    return [];
  }

  const events: GapEvent[] = [];

  for (let i = 1; i < series.length; i++) {
    const prevClose = series[i - 1].close;
    const open = series[i].open;

    if (!isValidPrice(prevClose) || !isValidPrice(open)) {
      continue;
    }

    const gapPct = open / prevClose - 1;
    if (Math.abs(gapPct) >= thresholdPct) {
      events.push({
        date: series[i].date,
        gapPct,
        open,
        prevClose,
      });
    }
  }

  return events;
}

/**
 * Detects volume spike events using z-scores.
 *
 * zScore = (volume - meanVolume) / stdVolume
 *
 * @param series - Daily OHLCV data sorted by date ascending
 * @param zThreshold - Minimum absolute z-score to flag (e.g., 2 or 3)
 * @returns Array of detected volume spike events with z-score context
 */
export function detectVolumeSpikes(
  series: StockTimeSeriesPoint[],
  zThreshold: number,
): VolumeSpikeEvent[] {
  if (series.length === 0 || zThreshold <= 0) {
    return [];
  }

  const volumes = series
    .map((point) => point.volume)
    .filter(isValidVolume);

  if (volumes.length < 2) {
    return [];
  }

  const meanVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  const stdVolume = populationStdDev(volumes);

  if (!Number.isFinite(stdVolume) || stdVolume === 0) {
    return [];
  }

  const events: VolumeSpikeEvent[] = [];

  for (const point of series) {
    if (!isValidVolume(point.volume)) {
      continue;
    }

    const zScore = (point.volume - meanVolume) / stdVolume;

    if (Math.abs(zScore) >= zThreshold) {
      events.push({
        date: point.date,
        zScore,
        volume: point.volume,
        avgVolume: meanVolume,
      });
    }
  }

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// Moving Averages & Trend Signals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a simple moving average (SMA) over a price series.
 *
 * The returned array is aligned with the input series but omits the first
 * `window - 1` entries because there is insufficient history to compute
 * a complete average.
 *
 * @param series - Array of date/close pairs sorted ascending by date
 * @param window - Number of observations in the averaging window
 * @returns Array of SMA points starting from the first complete window
 */
export function computeMovingAverage(
  series: CorrelationInput[],
  window: number,
): { date: string; ma: number }[] {
  if (window <= 0 || series.length === 0 || series.length < window) {
    return [];
  }

  const result: { date: string; ma: number }[] = [];
  let sum = 0;

  for (let i = 0; i < series.length; i++) {
    const price = series[i].close;
    if (!isValidPrice(price)) {
      return [];
    }

    sum += price;

    if (i >= window) {
      sum -= series[i - window].close;
    }

    if (i >= window - 1) {
      result.push({
        date: series[i].date,
        ma: sum / window,
      });
    }
  }

  return result;
}

/**
 * Computes short- and long-window moving averages aligned with the original series.
 *
 * Entries without sufficient history receive `null` for the corresponding MA.
 *
 * @param series - Array of date/close pairs sorted ascending by date
 * @param shortWindow - Window length for the fast average
 * @param longWindow - Window length for the slow average
 * @returns Array combining original closes with both moving averages
 */
export function computeDualMovingAverages(
  series: CorrelationInput[],
  shortWindow: number,
  longWindow: number,
): Array<{
  date: string;
  close: number;
  maShort: number | null;
  maLong: number | null;
}> {
  if (series.length === 0) {
    return [];
  }

  const shortMap =
    shortWindow > 0
      ? new Map(
          computeMovingAverage(series, shortWindow).map((point) => [
            point.date,
            point.ma,
          ]),
        )
      : new Map<string, number>();

  const longMap =
    longWindow > 0
      ? new Map(
          computeMovingAverage(series, longWindow).map((point) => [
            point.date,
            point.ma,
          ]),
        )
      : new Map<string, number>();

  return series.map((point) => ({
    date: point.date,
    close: point.close,
    maShort: shortMap.get(point.date) ?? null,
    maLong: longMap.get(point.date) ?? null,
  }));
}

/**
 * Detects moving-average crossover signals (golden/death crosses).
 *
 * Golden cross: short MA crosses above long MA (trend turning bullish).
 * Death cross: short MA crosses below long MA (trend turning bearish).
 *
 * @param data - Array with short/long moving averages per date (sorted ascending)
 * @returns Array of crossover events with their date and type
 */
export function detectMovingAverageCrossovers(
  data: { date: string; maShort: number | null; maLong: number | null }[],
): { date: string; type: "golden" | "death" }[] {
  const events: { date: string; type: "golden" | "death" }[] = [];
  let prevSign: -1 | 1 | null = null;

  for (const point of data) {
    if (point.maShort === null || point.maLong === null) {
      continue;
    }

    const diff = point.maShort - point.maLong;
    if (diff === 0) {
      continue;
    }

    const currentSign: -1 | 1 = diff > 0 ? 1 : -1;
    if (prevSign === null) {
      prevSign = currentSign;
      continue;
    }

    if (currentSign !== prevSign) {
      events.push({
        date: point.date,
        type: currentSign > 0 ? "golden" : "death",
      });
      prevSign = currentSign;
    }
  }

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// Moving Average Backtest
// ─────────────────────────────────────────────────────────────────────────────

function computeDrawdownFromEquity(
  curve: { date: string; equity: number }[],
): { equityCurve: { date: string; equity: number; drawdown: number }[]; maxDrawdown: number } {
  let peak = -Infinity;
  let maxDrawdown = 0;
  const result: { date: string; equity: number; drawdown: number }[] = [];

  for (const point of curve) {
    if (point.equity > peak) {
      peak = point.equity;
    }
    const drawdown = peak === 0 ? 0 : point.equity / peak - 1;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
    result.push({ ...point, drawdown });
  }

  return { equityCurve: result, maxDrawdown };
}

function computeCagr(
  startDate: string,
  endDate: string,
  totalReturn: number,
): number | null {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msDiff = end.getTime() - start.getTime();
  if (msDiff <= 0) {
    return null;
  }
  const years = msDiff / (1000 * 60 * 60 * 24 * 365.25);
  if (years <= 0) {
    return null;
  }
  return (1 + totalReturn) ** (1 / years) - 1;
}

/**
 * Backtests a simple long-only moving-average crossover strategy.
 *
 * - Start with equity = 1
 * - Enter long on golden cross (if flat)
 * - Exit to cash on death cross
 * - Equity remains constant while flat, grows with price when long
 */
export function backtestMaCrossoverStrategy(
  series: { date: string; close: number }[],
  crossovers: { date: string; type: "golden" | "death" }[],
): BacktestResult {
  if (series.length === 0) {
    return {
      trades: [],
      equityCurve: [],
      totalReturn: 0,
      maxDrawdown: 0,
      cagr: null,
    };
  }

  const priceMap = new Map(series.map((point) => [point.date, point.close]));
  const sortedCrossovers = [...crossovers].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const trades: Trade[] = [];
  let position: Trade | null = null;
  let equity = 1;
  let lastPrice = series[0].close;

  for (const crossover of sortedCrossovers) {
    const price = priceMap.get(crossover.date);
    if (!price || !isValidPrice(price)) {
      continue;
    }

    if (crossover.type === "golden" && position === null) {
      position = {
        entryDate: crossover.date,
        exitDate: null,
        entryPrice: price,
        exitPrice: null,
        return: null,
      };
      lastPrice = price;
    } else if (crossover.type === "death" && position !== null) {
      position.exitDate = crossover.date;
      position.exitPrice = price;
      position.return = price / position.entryPrice - 1;
      trades.push(position);
      position = null;
      equity *= price / lastPrice;
      lastPrice = price;
    }
  }

  const equityCurveRaw: { date: string; equity: number }[] = [];
  let currentEquity = 1;
  let invested = false;
  let entryEquity = equity;
  let entryPrice = 0;

  for (const point of series) {
    if (position && point.date === position.entryDate && !invested) {
      invested = true;
      entryEquity = currentEquity;
      entryPrice = position.entryPrice;
    }

    if (invested) {
      currentEquity = entryEquity * (point.close / entryPrice);
    } else {
      currentEquity = entryEquity;
    }

    equityCurveRaw.push({ date: point.date, equity: currentEquity });

    if (position && position.exitDate === point.date) {
      invested = false;
      entryEquity = currentEquity;
      entryPrice = point.close;
    }
  }

  if (position) {
    trades.push({
      ...position,
      exitDate: series[series.length - 1].date,
      exitPrice: series[series.length - 1].close,
      return: series[series.length - 1].close / position.entryPrice - 1,
    });
  }

  const totalReturn =
    equityCurveRaw.length > 0
      ? equityCurveRaw[equityCurveRaw.length - 1].equity - 1
      : 0;

  const { equityCurve, maxDrawdown } = computeDrawdownFromEquity(
    equityCurveRaw,
  );

  const cagr =
    equityCurveRaw.length > 1
      ? computeCagr(
          equityCurveRaw[0].date,
          equityCurveRaw[equityCurveRaw.length - 1].date,
          totalReturn,
        )
      : null;

  return {
    trades,
    equityCurve,
    totalReturn,
    maxDrawdown,
    cagr,
  };
}

/**
 * Buy & hold backtest (fully invested from first to last date).
 */
export function backtestBuyAndHold(
  series: { date: string; close: number }[],
): BacktestResult {
  if (series.length === 0) {
    return {
      trades: [],
      equityCurve: [],
      totalReturn: 0,
      maxDrawdown: 0,
      cagr: null,
    };
  }

  const equityCurve: { date: string; equity: number }[] = [];
  const firstPrice = series[0].close;
  for (const point of series) {
    equityCurve.push({
      date: point.date,
      equity: point.close / firstPrice,
    });
  }

  const { equityCurve: curveWithDrawdown, maxDrawdown } =
    computeDrawdownFromEquity(equityCurve);

  const totalReturn = equityCurve[equityCurve.length - 1].equity - 1;
  const cagr =
    equityCurve.length > 1
      ? computeCagr(
          equityCurve[0].date,
          equityCurve[equityCurve.length - 1].date,
          totalReturn,
        )
      : null;

  return {
    trades: [
      {
        entryDate: series[0].date,
        exitDate: series[series.length - 1].date,
        entryPrice: series[0].close,
        exitPrice: series[series.length - 1].close,
        return: series[series.length - 1].close / series[0].close - 1,
      },
    ],
    equityCurve: curveWithDrawdown,
    totalReturn,
    maxDrawdown,
    cagr,
  };
}

/**
 * Computes RSI using Wilder's smoothing method.
 */
export function computeRsi(
  series: { date: string; close: number }[],
  period: number,
): RsiPoint[] {
  if (series.length === 0 || period < 1) {
    return [];
  }

  const result: RsiPoint[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period && i < series.length; i++) {
    const change = series[i].close - series[i - 1].close;
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = 0; i < series.length; i++) {
    if (i < period) {
      result.push({ date: series[i].date, rsi: null });
      continue;
    }

    if (i > period) {
      const change = series[i].close - series[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    result.push({ date: series[i].date, rsi });
  }

  return result;
}

function computeEma(values: number[], period: number): number[] {
  if (values.length === 0 || period < 1) {
    return [];
  }
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let sum = 0;
  for (let i = 0; i < period && i < values.length; i++) {
    sum += values[i];
  }
  let prev = sum / period;
  ema[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    ema[i] = prev;
  }
  return ema;
}

/**
 * Computes MACD (EMA-based).
 */
export function computeMacd(
  series: { date: string; close: number }[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): MacdPoint[] {
  if (
    series.length === 0 ||
    fastPeriod < 1 ||
    slowPeriod < 1 ||
    signalPeriod < 1
  ) {
    return [];
  }

  const closes = series.map((point) => point.close);
  const fastEma = computeEma(closes, fastPeriod);
  const slowEma = computeEma(closes, slowPeriod);
  const macdLine: Array<number | null> = Array(series.length).fill(null);

  for (let i = 0; i < series.length; i++) {
    if (fastEma[i] !== undefined && slowEma[i] !== undefined) {
      macdLine[i] = fastEma[i]! - slowEma[i]!;
    }
  }

  const signalValues = macdLine
    .map((value) => value ?? NaN)
    .filter((value) => !Number.isNaN(value)) as number[];

  const signalEma = computeEma(signalValues, signalPeriod);
  const result: MacdPoint[] = [];
  let signalIndex = signalPeriod - 1;

  for (let i = 0; i < series.length; i++) {
    const macdValue = macdLine[i];
    if (macdValue === null) {
      result.push({ date: series[i].date, macd: null, signal: null, hist: null });
      continue;
    }

    let signalValue: number | null = null;
    if (i >= slowPeriod - 1 + signalPeriod - 1) {
      signalValue = signalEma[signalIndex];
      signalIndex++;
    }

    const hist =
      signalValue !== null ? macdValue - signalValue : null;
    result.push({
      date: series[i].date,
      macd: macdValue,
      signal: signalValue,
      hist,
    });
  }

  return result;
}

/**
 * Classifies market regimes based on MA, RSI, and volatility.
 */
export function classifyRegimes({
  closeSeries,
  maShortSeries,
  maLongSeries,
  rsiSeries,
  rollingVolSeries,
  volThresholdHigh = 0.35,
}: {
  closeSeries: { date: string; close: number }[];
  maShortSeries: { date: string; ma: number | null }[];
  maLongSeries: { date: string; ma: number | null }[];
  rsiSeries: { date: string; rsi: number | null }[];
  rollingVolSeries?: { date: string; vol: number }[];
  volThresholdHigh?: number;
}): RegimePoint[] {
  if (
    closeSeries.length === 0 ||
    maShortSeries.length === 0 ||
    maLongSeries.length === 0 ||
    rsiSeries.length === 0
  ) {
    return [];
  }

  const closeMap = new Map(closeSeries.map((point) => [point.date, point.close]));
  const maShortMap = new Map(
    maShortSeries.map((point) => [point.date, point.ma]),
  );
  const maLongMap = new Map(maLongSeries.map((point) => [point.date, point.ma]));
  const rsiMap = new Map(rsiSeries.map((point) => [point.date, point.rsi]));
  const volMap = rollingVolSeries
    ? new Map(rollingVolSeries.map((point) => [point.date, point.vol]))
    : new Map<string, number>();

  const dates = closeSeries.map((point) => point.date);
  const regimes: RegimePoint[] = [];

  for (const date of dates) {
    const maShort = maShortMap.get(date);
    const maLong = maLongMap.get(date);
    const rsi = rsiMap.get(date);
    const vol = volMap.get(date);

    if (maShort === undefined || maLong === undefined || rsi === undefined) {
      continue;
    }

    if (
      vol !== undefined &&
      Number.isFinite(vol) &&
      volThresholdHigh > 0 &&
      vol >= volThresholdHigh
    ) {
      regimes.push({ date, regime: "high-volatility" });
      continue;
    }

    if (
      maShort !== null &&
      maLong !== null &&
      rsi !== null &&
      maShort > maLong &&
      rsi >= 55
    ) {
      regimes.push({ date, regime: "uptrend" });
      continue;
    }

    if (
      maShort !== null &&
      maLong !== null &&
      rsi !== null &&
      maShort < maLong &&
      rsi <= 45
    ) {
      regimes.push({ date, regime: "downtrend" });
      continue;
    }

    regimes.push({ date, regime: "sideways" });
  }

  return regimes;
}

export function computePortfolioMetrics(
  portfolioSeries: PortfolioPoint[],
): {
  returns: DailyLogReturn[];
  sharpe: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  totalReturn: number | null;
} {
  if (portfolioSeries.length < 2) {
    return {
      returns: [],
      sharpe: null,
      volatility: null,
      maxDrawdown: null,
      totalReturn: null,
    };
  }

  const returns = getDailyLogReturns(
    portfolioSeries.map((point) => ({
      date: point.date,
      open: point.close,
      high: point.close,
      low: point.close,
      close: point.close,
      adjustedClose: point.close,
      volume: 0,
    })),
  );

  const sharpe = computeSharpeRatio(returns);

  const volatility =
    returns.length > 1
      ? (() => {
          const values = returns.map((r) => r.r);
          const mean =
            values.reduce((sum, value) => sum + value, 0) / values.length;
          const variance =
            values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
            (values.length - 1);
          return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
        })()
     : null;

  const drawdownSeries = computeDrawdown(
    portfolioSeries.map((point) => ({
      date: point.date,
      open: point.close,
      high: point.close,
      low: point.close,
      close: point.close,
      adjustedClose: point.close,
      volume: 0,
    })),
  );

  const maxDrawdown =
    drawdownSeries.length > 0
      ? Math.min(...drawdownSeries.map((point) => point.peakToTrough))
      : null;

  const totalReturn =
    portfolioSeries[portfolioSeries.length - 1].close / portfolioSeries[0].close - 1;

  return {
    returns,
    sharpe,
    volatility,
    maxDrawdown,
    totalReturn,
  };
}

/**
 * Builds equal-weight portfolio series from symbol closes.
 */
export function computePortfolioSeries(
  seriesBySymbol: Record<string, { date: string; close: number }[]>,
): PortfolioPoint[] {
  const symbols = Object.keys(seriesBySymbol);
  if (symbols.length === 0) {
    return [];
  }

  const dateSets = symbols.map((symbol) =>
    new Set(seriesBySymbol[symbol].map((point) => point.date)),
  );

  const commonDates = [...dateSets[0]].filter((date) =>
    dateSets.every((set) => set.has(date)),
  );

  if (commonDates.length === 0) {
    return [];
  }

  commonDates.sort();

  const normalizedSeries: Record<string, number[]> = {};

  for (const symbol of symbols) {
    const series = seriesBySymbol[symbol];
    const priceMap = new Map(series.map((point) => [point.date, point.close]));
    const firstClose = priceMap.get(commonDates[0]);
    if (!firstClose || !isValidPrice(firstClose)) {
      return [];
    }

    normalizedSeries[symbol] = commonDates.map((date) => {
      const close = priceMap.get(date);
      return close && isValidPrice(close) ? close / firstClose : NaN;
    });
  }

  const portfolioSeries: PortfolioPoint[] = [];

  for (let i = 0; i < commonDates.length; i++) {
    let sum = 0;
    let count = 0;
    for (const symbol of symbols) {
      const value = normalizedSeries[symbol][i];
      if (Number.isFinite(value)) {
        sum += value;
        count++;
      }
    }
    if (count === symbols.length) {
      portfolioSeries.push({
        date: commonDates[i],
        close: sum / count,
      });
    }
  }

  return portfolioSeries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes basic risk and return statistics from a stock time series.
 *
 * ## Assumptions
 * - Input series is sorted in ascending order by date (oldest first)
 * - Data represents daily trading data (for annualization)
 * - Prices are positive numbers
 *
 * ## Calculations
 * - **Last Close**: Most recent closing price in the series
 * - **1M Return**: Simple return over the last ~21 trading days
 * - **3M Return**: Simple return over the last ~63 trading days
 * - **Annualized Volatility**: Daily log return standard deviation × √252
 *
 * ## Edge Cases
 * - Empty series: Returns NaN for lastClose, null for all metrics
 * - Single data point: Returns the close price, null for all metrics
 * - Insufficient data for a metric: Returns null for that metric
 * - Invalid prices (NaN, ≤0): Filtered out before calculations
 *
 * @param series - Array of stock data points, sorted ascending by date
 * @returns Computed statistics object
 *
 * @example
 * ```ts
 * const stats = computeStats(priceData);
 * console.log(stats.lastClose);           // 150.25
 * console.log(stats.oneMonthReturn);      // 0.0523 (5.23%)
 * console.log(stats.annualizedVolatility); // 0.2341 (23.41%)
 * ```
 */
export function computeStats(series: StockTimeSeriesPoint[]): StockStats {
  // Handle empty series
  if (series.length === 0) {
    return {
      lastClose: NaN,
      oneMonthReturn: null,
      threeMonthReturn: null,
      annualizedVolatility: null,
    };
  }

  // Extract valid closing prices
  const closes = extractValidCloses(series);

  // Handle case where no valid prices exist
  if (closes.length === 0) {
    return {
      lastClose: NaN,
      oneMonthReturn: null,
      threeMonthReturn: null,
      annualizedVolatility: null,
    };
  }

  // Handle single data point
  if (closes.length === 1) {
    return {
      lastClose: closes[0],
      oneMonthReturn: null,
      threeMonthReturn: null,
      annualizedVolatility: null,
    };
  }

  const lastClose = closes[closes.length - 1];

  // Calculate returns for specific periods
  const getIndexForDaysAgo = (days: number): number | null => {
    const idx = closes.length - 1 - days;
    return idx >= 0 ? idx : null;
  };

  const oneMonthIdx = getIndexForDaysAgo(TRADING_DAYS_PER_MONTH);
  const threeMonthIdx = getIndexForDaysAgo(TRADING_DAYS_PER_QUARTER);

  const oneMonthReturn =
    oneMonthIdx !== null ? simpleReturn(lastClose, closes[oneMonthIdx]) : null;

  const threeMonthReturn =
    threeMonthIdx !== null
      ? simpleReturn(lastClose, closes[threeMonthIdx])
      : null;

  // Calculate annualized volatility from log returns
  let annualizedVolatility: number | null = null;

  if (closes.length >= MIN_POINTS_FOR_VOLATILITY) {
    const logReturns = computeLogReturns(closes);

    if (logReturns.length >= MIN_POINTS_FOR_VOLATILITY) {
      const dailyVol = sampleStdDev(logReturns);

      if (Number.isFinite(dailyVol)) {
        annualizedVolatility = dailyVol * Math.sqrt(TRADING_DAYS_PER_YEAR);
      }
    }
  }

  return {
    lastClose,
    oneMonthReturn,
    threeMonthReturn,
    annualizedVolatility,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Correlation Matrix
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum number of aligned data points required for correlation calculation */
const MIN_POINTS_FOR_CORRELATION = 3;

/**
 * Computes the Pearson correlation coefficient between two arrays.
 *
 * @param x - First array of values
 * @param y - Second array of values (must be same length as x)
 * @returns Pearson correlation coefficient in range [-1, 1], or NaN if calculation fails
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) {
    return NaN;
  }

  const n = x.length;

  // Calculate means
  const meanX = x.reduce((sum, v) => sum + v, 0) / n;
  const meanY = y.reduce((sum, v) => sum + v, 0) / n;

  // Calculate covariance and standard deviations
  let covariance = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    covariance += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  // Check for constant series (zero variance)
  if (varX === 0 || varY === 0) {
    return NaN;
  }

  const stdX = Math.sqrt(varX);
  const stdY = Math.sqrt(varY);

  const correlation = covariance / (stdX * stdY);

  // Clamp to [-1, 1] to handle floating point errors
  return Math.max(-1, Math.min(1, correlation));
}

/**
 * Computes log returns from a series with date-price pairs.
 * Returns a map of date -> log return for the day.
 *
 * @param series - Array of date-price pairs, sorted by date ascending
 * @returns Map from date to log return
 */
function computeLogReturnsMap(
  series: CorrelationInput[],
): Map<string, number> {
  const returnsMap = new Map<string, number>();

  for (let i = 1; i < series.length; i++) {
    const prevClose = series[i - 1].close;
    const currClose = series[i].close;

    if (isValidPrice(prevClose) && isValidPrice(currClose)) {
      const logReturn = Math.log(currClose / prevClose);
      if (Number.isFinite(logReturn)) {
        returnsMap.set(series[i].date, logReturn);
      }
    }
  }

  return returnsMap;
}

/**
 * Computes a correlation matrix of daily log-returns for multiple stock symbols.
 *
 * ## Algorithm
 * 1. For each symbol, compute daily log-returns
 * 2. Find dates common to all symbols (intersection)
 * 3. Align returns by date
 * 4. Compute Pearson correlation for each pair
 *
 * ## Edge Cases
 * - Less than 2 symbols: Returns empty matrix
 * - No common dates: Returns matrix with NaN values
 * - Constant returns (zero variance): Returns NaN for that pair
 * - Too few aligned data points: Returns NaN for affected pairs
 *
 * @param seriesBySymbol - Record mapping symbol to array of date-close pairs
 * @returns Correlation matrix with symbols and values
 *
 * @example
 * ```ts
 * const series = {
 *   AAPL: [{ date: "2024-01-01", close: 185 }, ...],
 *   MSFT: [{ date: "2024-01-01", close: 375 }, ...],
 * };
 * const matrix = computeCorrelationMatrix(series);
 * // matrix.symbols = ["AAPL", "MSFT"]
 * // matrix.values = [[1, 0.85], [0.85, 1]]
 * ```
 */
export function computeCorrelationMatrix(
  seriesBySymbol: Record<string, CorrelationInput[]>,
): CorrelationMatrix {
  const symbols = Object.keys(seriesBySymbol).sort();

  // Handle edge case: fewer than 2 symbols
  if (symbols.length < 2) {
    return {
      symbols,
      values: symbols.length === 1 ? [[1]] : [],
    };
  }

  // Compute log returns for each symbol
  const returnsBySymbol = new Map<string, Map<string, number>>();
  for (const symbol of symbols) {
    const series = seriesBySymbol[symbol];
    returnsBySymbol.set(symbol, computeLogReturnsMap(series));
  }

  // Find common dates across all symbols
  const allDateSets = symbols.map(
    (sym) => new Set(returnsBySymbol.get(sym)!.keys()),
  );
  const commonDates = [...allDateSets[0]].filter((date) =>
    allDateSets.every((dateSet) => dateSet.has(date)),
  );

  // Sort dates for consistent ordering
  commonDates.sort();

  // Extract aligned returns for each symbol
  const alignedReturns: Record<string, number[]> = {};
  for (const symbol of symbols) {
    const returnsMap = returnsBySymbol.get(symbol)!;
    alignedReturns[symbol] = commonDates.map((date) => returnsMap.get(date)!);
  }

  // Build correlation matrix
  const n = symbols.length;
  const values: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => NaN),
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        // Correlation with self is always 1
        values[i][j] = 1;
      } else if (j > i) {
        // Only compute upper triangle, then mirror
        const returnsI = alignedReturns[symbols[i]];
        const returnsJ = alignedReturns[symbols[j]];

        if (commonDates.length >= MIN_POINTS_FOR_CORRELATION) {
          const corr = pearsonCorrelation(returnsI, returnsJ);
          values[i][j] = corr;
          values[j][i] = corr;
        }
      }
    }
  }

  return { symbols, values };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rolling Statistics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes rolling (trailing) annualized volatility over a specified window.
 *
 * For each day, calculates the standard deviation of daily log returns
 * over the preceding `windowDays` trading days, then annualizes it.
 *
 * ## Algorithm
 * 1. Filter series to valid prices only
 * 2. Compute daily log returns
 * 3. For each position, take the last `windowDays - 1` returns
 * 4. Calculate std dev and annualize (× √252)
 *
 * ## Edge Cases
 * - Series shorter than window: Returns empty array
 * - Invalid prices (NaN, ≤0): Filtered out before computation
 * - Constant prices in window: Vol will be 0
 *
 * @param series - Array of stock data points, sorted ascending by date
 * @param windowDays - Number of trading days for the rolling window (e.g., 21 for 1 month)
 * @returns Array of rolling volatility points, starting from the first complete window
 *
 * @example
 * ```ts
 * const rollingVol = computeRollingVolatility(priceData, 21);
 * // rollingVol[0] = { date: "2024-01-22", vol: 0.2341 }
 * ```
 */
export function computeRollingVolatility(
  series: StockTimeSeriesPoint[],
  windowDays: number,
): RollingVolatilityPoint[] {
  // Need at least windowDays points to compute one rolling value
  if (series.length < windowDays || windowDays < 2) {
    return [];
  }

  // Filter to valid points and track their dates
  const validPoints: { date: string; close: number }[] = [];
  for (const point of series) {
    if (isValidPrice(point.close)) {
      validPoints.push({ date: point.date, close: point.close });
    }
  }

  if (validPoints.length < windowDays) {
    return [];
  }

  // Compute log returns with dates
  const logReturns: { date: string; ret: number }[] = [];
  for (let i = 1; i < validPoints.length; i++) {
    const logRet = Math.log(validPoints[i].close / validPoints[i - 1].close);
    if (Number.isFinite(logRet)) {
      logReturns.push({ date: validPoints[i].date, ret: logRet });
    }
  }

  // Need windowDays - 1 returns for the first complete window
  const returnsNeeded = windowDays - 1;
  if (logReturns.length < returnsNeeded) {
    return [];
  }

  const result: RollingVolatilityPoint[] = [];

  // Slide window through returns
  for (let i = returnsNeeded - 1; i < logReturns.length; i++) {
    const windowReturns: number[] = [];
    for (let j = i - returnsNeeded + 1; j <= i; j++) {
      windowReturns.push(logReturns[j].ret);
    }

    const dailyVol = sampleStdDev(windowReturns);
    if (Number.isFinite(dailyVol)) {
      result.push({
        date: logReturns[i].date,
        vol: dailyVol * Math.sqrt(TRADING_DAYS_PER_YEAR),
      });
    }
  }

  return result;
}

/**
 * Computes rolling (trailing) simple returns over a specified window.
 *
 * For each day, calculates the simple return from the price `windowDays`
 * ago to the current price.
 *
 * ## Algorithm
 * 1. Filter series to valid prices only
 * 2. For each position i where i >= windowDays:
 *    return = (price[i] / price[i - windowDays]) - 1
 *
 * ## Edge Cases
 * - Series shorter than window: Returns empty array
 * - Invalid prices (NaN, ≤0): Filtered out before computation
 *
 * @param series - Array of stock data points, sorted ascending by date
 * @param windowDays - Number of trading days for the rolling window (e.g., 21 for 1 month)
 * @returns Array of rolling return points, starting from the first complete window
 *
 * @example
 * ```ts
 * const rollingRet = computeRollingReturn(priceData, 21);
 * // rollingRet[0] = { date: "2024-01-22", ret: 0.0523 } // 5.23%
 * ```
 */
export function computeRollingReturn(
  series: StockTimeSeriesPoint[],
  windowDays: number,
): RollingReturnPoint[] {
  if (series.length < windowDays || windowDays < 1) {
    return [];
  }

  // Filter to valid points
  const validPoints: { date: string; close: number }[] = [];
  for (const point of series) {
    if (isValidPrice(point.close)) {
      validPoints.push({ date: point.date, close: point.close });
    }
  }

  if (validPoints.length <= windowDays) {
    return [];
  }

  const result: RollingReturnPoint[] = [];

  for (let i = windowDays; i < validPoints.length; i++) {
    const currentPrice = validPoints[i].close;
    const basePrice = validPoints[i - windowDays].close;
    const ret = currentPrice / basePrice - 1;

    if (Number.isFinite(ret)) {
      result.push({
        date: validPoints[i].date,
        ret,
      });
    }
  }

  return result;
}

/**
 * Computes the drawdown series from a stock's price history.
 *
 * Drawdown measures how far the price has fallen from its running maximum.
 * It is always negative or zero (0 when at a new high).
 *
 * ## Algorithm
 * 1. Track running peak (highest close seen so far)
 * 2. Drawdown = (current_price / peak) - 1
 * 3. Peak-to-trough tracks the worst drawdown observed up to this point
 *
 * ## Edge Cases
 * - Empty series: Returns empty array
 * - Invalid prices (NaN, ≤0): Filtered out before computation
 * - Single valid point: Returns single point with drawdown = 0
 *
 * @param series - Array of stock data points, sorted ascending by date
 * @returns Array of drawdown points for each valid date
 *
 * @example
 * ```ts
 * const drawdowns = computeDrawdown(priceData);
 * // drawdowns[10] = { date: "2024-01-15", drawdown: -0.05, peakToTrough: -0.08 }
 * // Current drawdown is 5%, worst so far is 8%
 * ```
 */
export function computeDrawdown(
  series: StockTimeSeriesPoint[],
): DrawdownPoint[] {
  if (series.length === 0) {
    return [];
  }

  // Filter to valid points
  const validPoints: { date: string; close: number }[] = [];
  for (const point of series) {
    if (isValidPrice(point.close)) {
      validPoints.push({ date: point.date, close: point.close });
    }
  }

  if (validPoints.length === 0) {
    return [];
  }

  const result: DrawdownPoint[] = [];
  let peak = validPoints[0].close;
  let worstDrawdown = 0;

  for (const point of validPoints) {
    // Update peak if we have a new high
    if (point.close > peak) {
      peak = point.close;
    }

    // Calculate current drawdown
    const drawdown = point.close / peak - 1;

    // Track worst drawdown seen so far
    if (drawdown < worstDrawdown) {
      worstDrawdown = drawdown;
    }

    result.push({
      date: point.date,
      drawdown,
      peakToTrough: worstDrawdown,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Return Distribution & Risk Metrics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts daily log returns from a stock time series.
 *
 * Log returns are computed as: r_t = ln(P_t / P_{t-1})
 *
 * Log returns are preferred for statistical analysis because they are:
 * - Time-additive (multi-period returns are the sum of single-period returns)
 * - More likely to be normally distributed
 * - Symmetric around zero
 *
 * ## Edge Cases
 * - Empty or single-point series: Returns empty array
 * - Invalid prices (NaN, ≤0): Skipped in calculation
 *
 * @param series - Array of stock data points, sorted ascending by date
 * @returns Array of daily log returns with dates
 *
 * @example
 * ```ts
 * const returns = getDailyLogReturns(priceData);
 * // returns[0] = { date: "2024-01-02", r: 0.0195 } // ~2% return
 * ```
 */
export function getDailyLogReturns(
  series: StockTimeSeriesPoint[],
): DailyLogReturn[] {
  if (series.length < 2) {
    return [];
  }

  const result: DailyLogReturn[] = [];

  for (let i = 1; i < series.length; i++) {
    const prevClose = series[i - 1].close;
    const currClose = series[i].close;

    if (isValidPrice(prevClose) && isValidPrice(currClose)) {
      const logReturn = Math.log(currClose / prevClose);
      if (Number.isFinite(logReturn)) {
        result.push({
          date: series[i].date,
          r: logReturn,
        });
      }
    }
  }

  return result;
}

/**
 * Computes a histogram of return distribution.
 *
 * Groups returns into equally-spaced bins and counts occurrences.
 * The bin centers are returned for plotting purposes.
 *
 * ## Algorithm
 * 1. Find min and max returns
 * 2. Create `binCount` equally-spaced bins
 * 3. Count returns falling into each bin
 *
 * ## Edge Cases
 * - Empty returns array: Returns empty array
 * - All returns equal: Returns single bin with all counts
 * - binCount < 1: Returns empty array
 *
 * @param returns - Array of daily log returns
 * @param binCount - Number of bins for the histogram (default: 30)
 * @returns Array of bins with center values and counts
 *
 * @example
 * ```ts
 * const histogram = computeReturnDistribution(returns, 30);
 * // histogram[15] = { binCenter: 0.001, count: 42 }
 * ```
 */
export function computeReturnDistribution(
  returns: DailyLogReturn[],
  binCount: number = 30,
): ReturnDistributionBin[] {
  if (returns.length === 0 || binCount < 1) {
    return [];
  }

  const values = returns.map((r) => r.r);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  // Handle case where all returns are equal
  if (minVal === maxVal) {
    return [{ binCenter: minVal, count: values.length }];
  }

  // Add small epsilon to include the max value in the last bin
  const range = maxVal - minVal;
  const binWidth = range / binCount;

  // Initialize bins
  const bins: ReturnDistributionBin[] = [];
  for (let i = 0; i < binCount; i++) {
    const binCenter = minVal + (i + 0.5) * binWidth;
    bins.push({ binCenter, count: 0 });
  }

  // Count returns in each bin
  for (const value of values) {
    let binIndex = Math.floor((value - minVal) / binWidth);
    // Handle edge case where value === maxVal
    if (binIndex >= binCount) {
      binIndex = binCount - 1;
    }
    bins[binIndex].count++;
  }

  return bins;
}

/**
 * Computes higher moments of a return distribution.
 *
 * ## Formulas
 * - Mean: μ = (1/n) Σ r_i
 * - Std: σ = √[(1/(n-1)) Σ (r_i - μ)²] (sample std dev with Bessel's correction)
 * - Skewness: γ₁ = (1/n) Σ [(r_i - μ)/σ]³ (Fisher's definition)
 * - Excess Kurtosis: γ₂ = (1/n) Σ [(r_i - μ)/σ]⁴ - 3 (normal distribution = 0)
 *
 * ## Interpretation
 * - Skewness > 0: Right-skewed (more extreme positive returns)
 * - Skewness < 0: Left-skewed (more extreme negative returns)
 * - Kurtosis > 0: Leptokurtic (fat tails, more extreme events than normal)
 * - Kurtosis < 0: Platykurtic (thin tails, fewer extreme events than normal)
 *
 * ## Edge Cases
 * - Less than 3 data points: Returns NaN for all values
 * - Zero variance: Returns NaN for skewness and kurtosis
 *
 * @param returns - Array of daily log returns
 * @returns Object with mean, std, skewness, and excess kurtosis
 *
 * @example
 * ```ts
 * const moments = computeHigherMoments(returns);
 * // moments = { mean: 0.0005, std: 0.015, skewness: -0.3, kurtosis: 2.1 }
 * ```
 */
export function computeHigherMoments(
  returns: DailyLogReturn[],
): HigherMoments {
  const nanResult: HigherMoments = {
    mean: NaN,
    std: NaN,
    skewness: NaN,
    kurtosis: NaN,
  };

  if (returns.length < 3) {
    return nanResult;
  }

  const values = returns.map((r) => r.r);
  const n = values.length;

  // Compute mean
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  // Compute variance (using n-1 for sample variance)
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (n - 1);
  const std = Math.sqrt(variance);

  // Guard against zero variance
  if (std === 0 || !Number.isFinite(std)) {
    return { mean, std: 0, skewness: NaN, kurtosis: NaN };
  }

  // Compute standardized moments
  let sumCubed = 0;
  let sumFourth = 0;

  for (const value of values) {
    const standardized = (value - mean) / std;
    sumCubed += standardized ** 3;
    sumFourth += standardized ** 4;
  }

  // Fisher's skewness (population formula for consistency)
  const skewness = sumCubed / n;

  // Excess kurtosis (subtract 3 so normal distribution = 0)
  const kurtosis = sumFourth / n - 3;

  return { mean, std, skewness, kurtosis };
}

/**
 * Computes the annualized Sharpe ratio from daily returns.
 *
 * ## Formula
 * Sharpe = (μ_annual - r_f) / σ_annual
 *
 * Where:
 * - μ_annual = μ_daily × 252 (annualized mean return)
 * - σ_annual = σ_daily × √252 (annualized volatility)
 * - r_f = annual risk-free rate (default: 0)
 *
 * ## Assumptions
 * - Returns are daily and i.i.d. (for annualization)
 * - 252 trading days per year
 * - Risk-free rate is expressed as an annual rate
 *
 * ## Edge Cases
 * - Less than 2 data points: Returns null
 * - Zero volatility: Returns null (undefined ratio)
 *
 * @param returns - Array of daily log returns
 * @param riskFreeRateAnnual - Annual risk-free rate (default: 0)
 * @returns Annualized Sharpe ratio, or null if cannot be computed
 *
 * @example
 * ```ts
 * const sharpe = computeSharpeRatio(returns, 0.05); // 5% risk-free rate
 * // sharpe = 1.25
 * ```
 */
export function computeSharpeRatio(
  returns: DailyLogReturn[],
  riskFreeRateAnnual: number = 0,
): number | null {
  if (returns.length < 2) {
    return null;
  }

  const values = returns.map((r) => r.r);
  const n = values.length;

  // Compute mean daily return
  const meanDaily = values.reduce((sum, v) => sum + v, 0) / n;

  // Compute daily volatility (sample std dev)
  const squaredDiffs = values.map((v) => (v - meanDaily) ** 2);
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (n - 1);
  const stdDaily = Math.sqrt(variance);

  // Guard against zero or invalid volatility
  if (stdDaily === 0 || !Number.isFinite(stdDaily)) {
    return null;
  }

  // Annualize
  const meanAnnual = meanDaily * TRADING_DAYS_PER_YEAR;
  const stdAnnual = stdDaily * Math.sqrt(TRADING_DAYS_PER_YEAR);

  // Compute Sharpe ratio
  const sharpe = (meanAnnual - riskFreeRateAnnual) / stdAnnual;

  return Number.isFinite(sharpe) ? sharpe : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rolling Correlation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aligns two time series by their dates, keeping only dates present in both.
 *
 * @param seriesA - First series with date and close price
 * @param seriesB - Second series with date and close price
 * @returns Object with aligned arrays and corresponding dates
 */
function alignSeriesByDate(
  seriesA: CorrelationInput[],
  seriesB: CorrelationInput[]
): { dates: string[]; pricesA: number[]; pricesB: number[] } {
  // Create maps for efficient lookup
  const mapA = new Map<string, number>();
  const mapB = new Map<string, number>();

  for (const point of seriesA) {
    if (isValidPrice(point.close)) {
      mapA.set(point.date, point.close);
    }
  }

  for (const point of seriesB) {
    if (isValidPrice(point.close)) {
      mapB.set(point.date, point.close);
    }
  }

  // Find common dates
  const commonDates: string[] = [];
  for (const date of mapA.keys()) {
    if (mapB.has(date)) {
      commonDates.push(date);
    }
  }

  // Sort dates chronologically
  commonDates.sort();

  // Extract aligned prices
  const pricesA: number[] = [];
  const pricesB: number[] = [];

  for (const date of commonDates) {
    pricesA.push(mapA.get(date)!);
    pricesB.push(mapB.get(date)!);
  }

  return { dates: commonDates, pricesA, pricesB };
}

/**
 * Computes rolling correlation between two stock price series.
 *
 * Uses log returns and Pearson correlation over a rolling window.
 * The correlation at each date represents the correlation over the
 * preceding windowDays trading days.
 *
 * ## Algorithm
 * 1. Align the two series by date (intersection)
 * 2. Compute log returns for each series
 * 3. For each position with enough history:
 *    - Take the last windowDays-1 returns
 *    - Compute Pearson correlation
 *
 * ## Edge Cases
 * - No common dates: Returns empty array
 * - Insufficient data for window: Returns empty array
 * - Constant prices in window: Correlation will be NaN
 *
 * @param seriesA - First stock's price series with dates
 * @param seriesB - Second stock's price series with dates
 * @param windowDays - Number of trading days for rolling window (e.g., 63 for ~3 months)
 * @returns Array of rolling correlation points
 *
 * @example
 * ```ts
 * const correlations = computeRollingCorrelation(
 *   appleData,
 *   microsoftData,
 *   63
 * );
 * // correlations[0] = { date: "2024-03-15", corr: 0.85 }
 * ```
 */
export function computeRollingCorrelation(
  seriesA: CorrelationInput[],
  seriesB: CorrelationInput[],
  windowDays: number
): RollingCorrelationPoint[] {
  // Need at least windowDays points for one calculation
  if (windowDays < 2) {
    return [];
  }

  // Align series by date
  const { dates, pricesA, pricesB } = alignSeriesByDate(seriesA, seriesB);

  // Need at least windowDays aligned points
  if (dates.length < windowDays) {
    return [];
  }

  // Compute log returns for both series
  const returnsA: number[] = [];
  const returnsB: number[] = [];

  for (let i = 1; i < pricesA.length; i++) {
    const retA = Math.log(pricesA[i] / pricesA[i - 1]);
    const retB = Math.log(pricesB[i] / pricesB[i - 1]);

    if (Number.isFinite(retA) && Number.isFinite(retB)) {
      returnsA.push(retA);
      returnsB.push(retB);
    } else {
      // If either return is invalid, skip this date
      // This maintains alignment between the two return series
      returnsA.push(NaN);
      returnsB.push(NaN);
    }
  }

  // Need windowDays - 1 returns for the first window
  const returnsNeeded = windowDays - 1;
  if (returnsA.length < returnsNeeded) {
    return [];
  }

  const result: RollingCorrelationPoint[] = [];

  // Slide window through returns
  for (let i = returnsNeeded - 1; i < returnsA.length; i++) {
    // Extract window of returns, filtering out NaN values
    const windowReturnsA: number[] = [];
    const windowReturnsB: number[] = [];

    for (let j = i - returnsNeeded + 1; j <= i; j++) {
      if (!isNaN(returnsA[j]) && !isNaN(returnsB[j])) {
        windowReturnsA.push(returnsA[j]);
        windowReturnsB.push(returnsB[j]);
      }
    }

    // Need at least 2 valid points for correlation
    if (windowReturnsA.length >= 2) {
      const corr = pearsonCorrelation(windowReturnsA, windowReturnsB);

      if (Number.isFinite(corr)) {
        // The date for this correlation is at position i+1 in the dates array
        // (since returns start from index 1)
        result.push({
          date: dates[i + 1],
          corr,
        });
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPM Analytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes CAPM statistics (beta, alpha, R²) between an asset and benchmark.
 *
 * Uses daily log returns and ordinary least squares:
 *   r_asset = alpha + beta * r_benchmark + ε
 *
 * @param asset - Asset close series sorted by date
 * @param benchmark - Benchmark close series sorted by date
 * @returns CAPM statistics object with daily/annual alpha
 */
export function computeCapmStats(
  asset: CorrelationInput[],
  benchmark: CorrelationInput[],
): CapmStats {
  const empty: CapmStats = {
    beta: null,
    alphaDaily: null,
    alphaAnnual: null,
    r2: null,
  };

  if (asset.length < 2 || benchmark.length < 2) {
    return empty;
  }

  const { pricesA, pricesB } = alignSeriesByDate(asset, benchmark);
  if (pricesA.length < 2 || pricesB.length < 2) {
    return empty;
  }

  const returnsA: number[] = [];
  const returnsB: number[] = [];

  for (let i = 1; i < pricesA.length; i++) {
    const retA = Math.log(pricesA[i] / pricesA[i - 1]);
    const retB = Math.log(pricesB[i] / pricesB[i - 1]);

    if (Number.isFinite(retA) && Number.isFinite(retB)) {
      returnsA.push(retA);
      returnsB.push(retB);
    }
  }

  if (returnsA.length < 2) {
    return empty;
  }

  const n = returnsA.length;
  const meanA = returnsA.reduce((sum, r) => sum + r, 0) / n;
  const meanB = returnsB.reduce((sum, r) => sum + r, 0) / n;

  let covariance = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < n; i++) {
    const da = returnsA[i] - meanA;
    const db = returnsB[i] - meanB;
    covariance += da * db;
    varA += da * da;
    varB += db * db;
  }

  // Use sample statistics (n-1 denominator) for covariance/variance
  covariance /= n - 1;
  varA /= n - 1;
  varB /= n - 1;

  if (!Number.isFinite(varB) || varB === 0 || !Number.isFinite(covariance)) {
    return empty;
  }

  const beta = covariance / varB;
  const alphaDaily = meanA - beta * meanB;
  const alphaAnnual = alphaDaily * TRADING_DAYS_PER_YEAR;

  let r2: number | null = null;
  if (Number.isFinite(varA) && varA > 0) {
    const r = covariance / Math.sqrt(varA * varB);
    if (Number.isFinite(r)) {
      r2 = Math.max(0, Math.min(1, r * r));
    }
  }

  return {
    beta: Number.isFinite(beta) ? beta : null,
    alphaDaily: Number.isFinite(alphaDaily) ? alphaDaily : null,
    alphaAnnual: Number.isFinite(alphaAnnual) ? alphaAnnual : null,
    r2,
  };
}
/**
 * Backtest trade record for MA crossover strategy.
 */
export type Trade = {
  entryDate: string;
  exitDate: string | null;
  entryPrice: number;
  exitPrice: number | null;
  return: number | null;
};

/**
 * Result bundle for MA crossover backtest.
 */
export type BacktestResult = {
  trades: Trade[];
  equityCurve: { date: string; equity: number; drawdown: number }[];
  totalReturn: number;
  maxDrawdown: number;
  cagr: number | null;
};

/**
 * RSI data point.
 */
export type RsiPoint = {
  date: string;
  rsi: number | null;
};

/**
 * MACD data point.
 */
export type MacdPoint = {
  date: string;
  macd: number | null;
  signal: number | null;
  hist: number | null;
};

/**
 * Market regime classification.
 */
export type MarketRegime =
  | "uptrend"
  | "downtrend"
  | "sideways"
  | "high-volatility";

/**
 * Regime value for a single date.
 */
export type RegimePoint = {
  date: string;
  regime: MarketRegime;
};

/**
 * Equal-weight portfolio time series.
 */
export type PortfolioPoint = {
  date: string;
  close: number;
};
