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
 * S&P 500 Index - used as a market benchmark.
 * Always included in correlation matrix for comparison.
 * Using the actual index (^SPX) rather than ETF for more accurate correlation.
 */
export const SP500_INDEX: StockTicker = {
  symbol: "^SPX",
  name: "S&P 500 Index",
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
  { symbol: "QQQ", name: "Invesco QQQ Trust" },
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
 * Market indices and commodities for benchmarking.
 * Yahoo Finance fully supports these symbols.
 */
export const MARKET_INDICES: StockTicker[] = [
  SP500_INDEX,
  { symbol: "^DJI", name: "Dow Jones Industrial Average" },
  { symbol: "^IXIC", name: "NASDAQ Composite" },
  { symbol: "^RUT", name: "Russell 2000 Index" },
  { symbol: "^VIX", name: "CBOE Volatility Index" },
  { symbol: "GC=F", name: "Gold Futures" },
  { symbol: "SI=F", name: "Silver Futures" },
  { symbol: "CL=F", name: "Crude Oil Futures" },
  { symbol: "DX-Y.NYB", name: "US Dollar Index" },
  { symbol: "^TNX", name: "10-Year Treasury Yield" },
] as const;

/**
 * Combined list of all available symbols (stocks + indices).
 */
export const ALL_SYMBOLS = [...NASDAQ_STOCKS, ...MARKET_INDICES] as const;

/**
 * Set of valid stock symbols for O(1) lookup.
 */
export const VALID_SYMBOLS = new Set(
  ALL_SYMBOLS.map((stock) => stock.symbol),
);

/**
 * Default benchmark symbol used for CAPM analytics.
 */
export const DEFAULT_BENCHMARK_SYMBOL = "QQQ";

/**
 * Helper function to determine if a symbol is an index (not priced in dollars).
 */
export function isIndex(symbol: string): boolean {
  return symbol.startsWith('^');
}

/**
 * Helper function to determine if a symbol is a commodity futures contract.
 */
export function isCommodity(symbol: string): boolean {
  return symbol.includes('=F');
}

/**
 * Helper function to determine if a symbol should display currency.
 */
export function shouldShowCurrency(symbol: string): boolean {
  // Indices don't have currency, everything else does
  return !isIndex(symbol);
}

/**
 * Helper to get the human-readable name for a ticker.
 */
export function getSymbolDisplayName(symbol: string): string {
  const found = ALL_SYMBOLS.find((stock) => stock.symbol === symbol);
  return found?.name ?? symbol;
}
