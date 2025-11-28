import { NextResponse } from "next/server";
import { fetchDailySeries } from "@/lib/yahooFinance";
import { NASDAQ_STOCKS } from "@/lib/stocks";
import type { StockApiResponse } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route context containing dynamic parameters.
 */
type RouteContext = {
  params: Promise<{ symbol: string }>;
};

/**
 * Error response structure.
 */
type ErrorResponse = {
  error: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/stocks/[symbol]
 *
 * Fetches daily time series data for a stock symbol.
 *
 * @param _request - The incoming request (unused)
 * @param context - Route context containing the symbol parameter
 * @returns JSON response with stock data or error message
 *
 * @example
 * // Success response (200)
 * {
 *   "symbol": "AAPL",
 *   "lastRefreshed": "2024-01-15",
 *   "series": [{ "date": "2024-01-15", "close": 185.92, ... }]
 * }
 *
 * @example
 * // Error response (400 or 500)
 * { "error": "Symbol not allowed in this dashboard" }
 */
export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<StockApiResponse | ErrorResponse>> {
  const { symbol: rawSymbol } = await context.params;
  const symbol = rawSymbol.toUpperCase();

  // Validate symbol is in the allowed list
  const isAllowed = NASDAQ_STOCKS.some((stock) => stock.symbol === symbol);

  if (!isAllowed) {
    return NextResponse.json(
      { error: "Symbol not allowed in this dashboard" },
      { status: 400 },
    );
  }

  try {
    const data = await fetchDailySeries(symbol);

    const response: StockApiResponse = {
      symbol: data.meta.symbol,
      lastRefreshed: data.meta.lastRefreshed,
      series: data.series,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
