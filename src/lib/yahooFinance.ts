/**
 * Yahoo Finance data fetching module.
 *
 * Provides functions to fetch historical stock data from Yahoo Finance.
 * This module is intended for server-side use only.
 */

import YahooFinance from "yahoo-finance2";
import type { StockTimeSeriesPoint } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response structure from the Yahoo Finance data fetching function.
 * Mirrors the API response format for consistency.
 */
export type YahooFinanceResponse = {
  meta: {
    symbol: string;
    lastRefreshed: string;
  };
  series: StockTimeSeriesPoint[];
};

/**
 * Internal type for Yahoo Finance chart quote data.
 * Represents the raw data structure returned by the yahoo-finance2 library.
 */
type YahooQuote = {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjclose?: number | null;
  volume: number | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Module State
// ─────────────────────────────────────────────────────────────────────────────

/** Singleton Yahoo Finance client instance */
const yahooFinance = new YahooFinance();

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Number of years of historical data to fetch */
const HISTORY_YEARS = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a quote has all required OHLC data.
 */
function isValidQuote(quote: YahooQuote): boolean {
  return (
    quote.open != null &&
    quote.high != null &&
    quote.low != null &&
    quote.close != null &&
    Number.isFinite(quote.open) &&
    Number.isFinite(quote.high) &&
    Number.isFinite(quote.low) &&
    Number.isFinite(quote.close)
  );
}

/**
 * Converts a Yahoo Finance quote to our internal format.
 * Assumes the quote has been validated with isValidQuote.
 */
function convertQuote(quote: YahooQuote): StockTimeSeriesPoint {
  return {
    date: quote.date.toISOString().split("T")[0],
    open: quote.open!,
    high: quote.high!,
    low: quote.low!,
    close: quote.close!,
    adjustedClose: quote.adjclose ?? quote.close!,
    volume: quote.volume ?? 0,
  };
}

/**
 * Creates the date range for fetching historical data.
 */
function getDateRange(): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - HISTORY_YEARS);
  return { startDate, endDate };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches historical daily OHLC data for a given stock symbol from Yahoo Finance.
 *
 * @param symbol - Stock ticker symbol (e.g., "AAPL", "MSFT")
 * @returns Promise resolving to the stock time series data
 * @throws Error if symbol is empty, invalid, or no data is available
 *
 * @example
 * ```ts
 * const data = await fetchDailySeries("AAPL");
 * console.log(data.meta.symbol); // "AAPL"
 * console.log(data.series.length); // ~500 (trading days in 2 years)
 * ```
 */
export async function fetchDailySeries(
  symbol: string,
): Promise<YahooFinanceResponse> {
  // Validate and normalize symbol
  const trimmedSymbol = symbol.trim().toUpperCase();

  if (!trimmedSymbol) {
    throw new Error("Symbol is required");
  }

  // Validate symbol format (basic check for alphanumeric with optional dots/dashes/equals/carets)
  if (!/^[A-Z0-9.\-=^]+$/.test(trimmedSymbol)) {
    throw new Error("Invalid symbol format");
  }

  const { startDate, endDate } = getDateRange();

  let result: { quotes: YahooQuote[] };

  try {
    result = await yahooFinance.chart(trimmedSymbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });
  } catch (err: unknown) {
    // Re-throw with a user-friendly message (don't leak internal details)
    const message =
      err instanceof Error && err.message.includes("Not Found")
        ? `Symbol "${trimmedSymbol}" not found`
        : "Failed to fetch data from Yahoo Finance";
    throw new Error(message);
  }

  if (!result.quotes || result.quotes.length === 0) {
    throw new Error(`No data available for symbol "${trimmedSymbol}"`);
  }

  // Filter and convert quotes
  const series: StockTimeSeriesPoint[] = result.quotes
    .filter(isValidQuote)
    .map(convertQuote)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (series.length === 0) {
    throw new Error(`No valid price data for symbol "${trimmedSymbol}"`);
  }

  const lastDate =
    series.at(-1)?.date ?? new Date().toISOString().split("T")[0];

  return {
    meta: {
      symbol: trimmedSymbol,
      lastRefreshed: lastDate,
    },
    series,
  };
}
