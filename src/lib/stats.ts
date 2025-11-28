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
