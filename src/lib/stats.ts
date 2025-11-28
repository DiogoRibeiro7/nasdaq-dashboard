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
