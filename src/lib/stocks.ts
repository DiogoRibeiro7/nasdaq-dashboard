/**
 * Stock ticker definitions and constants.
 *
 * Contains the list of NASDAQ stocks available in this dashboard.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents a stock ticker with its symbol and company name.
 */
export type StockTicker = {
  /** Stock ticker symbol (e.g., "AAPL") */
  symbol: string;
  /** Full company name (e.g., "Apple Inc.") */
  name: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * S&P 500 Index ETF - used as a market benchmark.
 * Always included in correlation matrix for comparison.
 */
export const SP500_INDEX: StockTicker = {
  symbol: "SPY",
  name: "S&P 500 ETF",
};

/**
 * List of NASDAQ stocks available in this dashboard.
 *
 * This list is used for:
 * - Populating the stock selector dropdown
 * - Validating API requests (only these symbols are allowed)
 * - Multi-stock comparison feature
 */
export const NASDAQ_STOCKS: StockTicker[] = [
  SP500_INDEX,
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)" },
  { symbol: "AMZN", name: "Amazon.com, Inc." },
  { symbol: "META", name: "Meta Platforms, Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "NFLX", name: "Netflix, Inc." },
  { symbol: "INTC", name: "Intel Corporation" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc." },
  { symbol: "CSCO", name: "Cisco Systems, Inc." },
  { symbol: "PEP", name: "PepsiCo, Inc." },
  { symbol: "COST", name: "Costco Wholesale Corporation" },
  { symbol: "AVGO", name: "Broadcom Inc." },
  { symbol: "QCOM", name: "QUALCOMM Incorporated" },
  { symbol: "TXN", name: "Texas Instruments Incorporated" },
  { symbol: "PYPL", name: "PayPal Holdings, Inc." },
  { symbol: "INTU", name: "Intuit Inc." },
  { symbol: "AMAT", name: "Applied Materials, Inc." },
  { symbol: "PATH", name: "UiPath Inc." },
  { symbol: "AI", name: "C3.ai, Inc." },
] as const;

/**
 * Set of valid stock symbols for O(1) lookup.
 */
export const VALID_SYMBOLS = new Set(
  NASDAQ_STOCKS.map((stock) => stock.symbol),
);
