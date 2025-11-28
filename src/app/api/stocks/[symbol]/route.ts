import { NextResponse } from "next/server";
import { fetchDailySeries } from "@/lib/alphaVantage";
import { NASDAQ_STOCKS } from "@/lib/stocks";

/**
 * GET /api/stocks/[symbol]
 *
 * Returns daily time series for an allowed symbol.
 */
export async function GET(
  _request: Request,
  context: { params: { symbol: string } },
) {
  const symbol = context.params.symbol.toUpperCase();

  const allowed = NASDAQ_STOCKS.some((s) => s.symbol === symbol);
  if (!allowed) {
    return NextResponse.json(
      { error: "Symbol not allowed in this dashboard" },
      { status: 400 },
    );
  }

  try {
    const data = await fetchDailySeries(symbol);

    return NextResponse.json({
      symbol: data.meta.symbol,
      lastRefreshed: data.meta.lastRefreshed,
      series: data.series,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
