/**
 * Shared type definitions for the stock dashboard.
 *
 * This module centralizes types used across components and API layers
 * to ensure consistency and avoid duplication.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Time Series Data Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single data point in a stock time series (daily OHLCV).
 */
export type StockTimeSeriesPoint = {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Opening price */
  open: number;
  /** Highest price during the trading day */
  high: number;
  /** Lowest price during the trading day */
  low: number;
  /** Closing price */
  close: number;
  /** Adjusted closing price (accounts for splits/dividends) */
  adjustedClose: number;
  /** Trading volume */
  volume: number;
};

/**
 * Response structure from the stock API endpoint.
 */
export type StockApiResponse = {
  /** Stock ticker symbol (uppercase) */
  symbol: string;
  /** Date of the most recent data point */
  lastRefreshed: string;
  /** Array of daily price data, sorted ascending by date */
  series: StockTimeSeriesPoint[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch State Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents the state of an async data fetch operation.
 * Use discriminated union for type-safe state handling.
 */
export type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Time Range Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Available time range options for filtering stock data.
 */
export type TimeRange = "1M" | "3M" | "6M" | "1Y" | "MAX";

/**
 * Mapping of time ranges to approximate trading days.
 * Based on ~252 trading days per year.
 */
export const TIME_RANGE_DAYS: Record<Exclude<TimeRange, "MAX">, number> = {
  "1M": 21,
  "3M": 63,
  "6M": 126,
  "1Y": 252,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Chart Data Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simplified data point for single-stock charts.
 */
export type ChartPoint = {
  date: string;
  close: number;
};

/**
 * Data row for multi-stock comparison charts.
 * Contains date and dynamic symbol keys with normalized values.
 */
export type MultiChartRow = {
  date: string;
  [symbol: string]: string | number;
};
