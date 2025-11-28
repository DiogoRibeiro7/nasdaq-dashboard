export type AlphaVantageTimeSeriesPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
};

export type AlphaVantageTimeSeriesResponse = {
  meta: {
    symbol: string;
    lastRefreshed: string;
  };
  series: AlphaVantageTimeSeriesPoint[];
};

/**
 * Fetch daily adjusted OHLC data for a given symbol from Alpha Vantage.
 *
 * This function is meant to run on the server only. It uses the API key from
 * the ALPHA_VANTAGE_API_KEY environment variable. Make sure this is set in
 * your local .env.local and in Vercel.
 */
export async function fetchDailySeries(
  symbol: string,
): Promise<AlphaVantageTimeSeriesResponse> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing ALPHA_VANTAGE_API_KEY. Set it in your environment variables.",
    );
  }

  const trimmedSymbol = symbol.trim().toUpperCase();

  if (!trimmedSymbol) {
    throw new Error("Symbol is required");
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TIME_SERIES_DAILY_ADJUSTED");
  url.searchParams.set("symbol", trimmedSymbol);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("outputsize", "compact");

  const res = await fetch(url.toString(), {
    method: "GET",
    next: { revalidate: 900 }
  });

  if (!res.ok) {
    throw new Error(`Alpha Vantage request failed with status ${res.status}`);
  }

  const json = (await res.json()) as any;

  // Check for Alpha Vantage error messages
  if (json["Error Message"]) {
    throw new Error(`Alpha Vantage error: ${json["Error Message"]}`);
  }

  if (json["Note"]) {
    throw new Error(`Alpha Vantage rate limit: ${json["Note"]}`);
  }

  if (json["Information"]) {
    throw new Error(`Alpha Vantage: ${json["Information"]}`);
  }

  if (!json["Time Series (Daily)"]) {
    throw new Error("Unexpected Alpha Vantage response format");
  }

  const meta = json["Meta Data"];
  const ts = json["Time Series (Daily)"] as Record<
    string,
    Record<string, string>
  >;

  const series: AlphaVantageTimeSeriesPoint[] = Object.entries(ts)
    .map(([date, values]) => ({
      date,
      open: Number(values["1. open"]),
      high: Number(values["2. high"]),
      low: Number(values["3. low"]),
      close: Number(values["4. close"]),
      adjustedClose: Number(values["5. adjusted close"]),
      volume: Number(values["6. volume"]),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    meta: {
      symbol: trimmedSymbol,
      lastRefreshed: meta["3. Last Refreshed"] ?? series.at(-1)?.date ?? "",
    },
    series,
  };
}
