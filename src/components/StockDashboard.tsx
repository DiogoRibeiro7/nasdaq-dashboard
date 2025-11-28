"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { StockSelector } from "@/components/StockSelector";
import { StockChart } from "@/components/StockChart";
import { StatsCards } from "@/components/StatsCards";
import { computeStats, computeCorrelationMatrix } from "@/lib/stats";
import type { CorrelationMatrix } from "@/lib/stats";
import { MultiStockSelector } from "@/components/MultiStockSelector";
import { MultiStockChart } from "@/components/MultiStockChart";
import { CorrelationHeatmap } from "@/components/CorrelationHeatmap";
import type {
  ChartPoint,
  FetchState,
  MultiChartRow,
  StockApiResponse,
  StockTimeSeriesPoint,
  TimeRange,
} from "@/lib/types";
import { TIME_RANGE_DAYS } from "@/lib/types";
import { SP500_INDEX } from "@/lib/stocks";

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filters a time series to the most recent N trading days based on the
 * selected range. Returns the full series for "MAX".
 *
 * @param series - Array of stock data points, sorted ascending by date
 * @param range - Time range to filter to
 * @returns Filtered series containing only the most recent data points
 */
function filterByRange(
  series: StockTimeSeriesPoint[],
  range: TimeRange,
): StockTimeSeriesPoint[] {
  if (range === "MAX") return series;

  const days = TIME_RANGE_DAYS[range];
  if (series.length <= days) return series;

  return series.slice(series.length - days);
}

/**
 * Extracts an error message from an API response body.
 * Falls back to a generic status-based message if parsing fails.
 */
async function extractErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const body = await response.json() as { error?: string } | null;
    return body?.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-side dashboard for viewing stock data.
 *
 * Features:
 * - Single stock selection with price chart and statistics
 * - Configurable time range (1M, 3M, 6M, 1Y, MAX)
 * - Multi-stock comparison with normalized relative performance
 *
 * Data is fetched from the internal `/api/stocks/[symbol]` endpoint.
 */
export function StockDashboard(): JSX.Element {
  // ───────────────────────────────────────────────────────────────────────────
  // State
  // ───────────────────────────────────────────────────────────────────────────

  const [symbol, setSymbol] = useState<string>("AAPL");
  const [range, setRange] = useState<TimeRange>("3M");

  const [singleState, setSingleState] = useState<FetchState<StockApiResponse>>({
    status: "idle",
  });

  const [multiSelectedSymbols, setMultiSelectedSymbols] = useState<string[]>([
    "AAPL",
    "MSFT",
    "GOOGL",
  ]);

  const [multiState, setMultiState] = useState<
    FetchState<Record<string, StockApiResponse>>
  >({ status: "idle" });

  // ───────────────────────────────────────────────────────────────────────────
  // Data Fetching
  // ───────────────────────────────────────────────────────────────────────────

  // Fetch single stock data when symbol changes
  useEffect(() => {
    let cancelled = false;

    async function loadSingleStock(): Promise<void> {
      setSingleState({ status: "loading" });

      try {
        const response = await fetch(`/api/stocks/${symbol}`);

        if (!response.ok) {
          const errorMessage = await extractErrorMessage(response);
          if (!cancelled) {
            setSingleState({ status: "error", error: errorMessage });
          }
          return;
        }

        const data = (await response.json()) as StockApiResponse;
        if (!cancelled) {
          setSingleState({ status: "success", data });
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Unexpected error while fetching stock data";
        setSingleState({ status: "error", error: message });
      }
    }

    void loadSingleStock();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Fetch multi-stock data when selected symbols change
  // Always include SPY (S&P 500) for correlation matrix benchmark
  useEffect(() => {
    if (multiSelectedSymbols.length === 0) {
      setMultiState({ status: "idle" });
      return;
    }

    let cancelled = false;

    async function loadMultipleStocks(): Promise<void> {
      setMultiState({ status: "loading" });

      // Always fetch SPY for correlation benchmark, even if not selected
      const symbolsToFetch = multiSelectedSymbols.includes(SP500_INDEX.symbol)
        ? multiSelectedSymbols
        : [SP500_INDEX.symbol, ...multiSelectedSymbols];

      try {
        const responses = await Promise.all(
          symbolsToFetch.map(async (sym) => {
            const response = await fetch(`/api/stocks/${sym}`);

            if (!response.ok) {
              const errorMessage = await extractErrorMessage(response);
              throw new Error(errorMessage);
            }

            const data = (await response.json()) as StockApiResponse;
            return [sym, data] as const;
          }),
        );

        if (cancelled) return;

        const dataMap: Record<string, StockApiResponse> = {};
        for (const [sym, data] of responses) {
          dataMap[sym] = data;
        }

        setMultiState({ status: "success", data: dataMap });
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Unexpected error while fetching comparison data";
        setMultiState({ status: "error", error: message });
      }
    }

    void loadMultipleStocks();

    return () => {
      cancelled = true;
    };
  }, [multiSelectedSymbols]);

  // ───────────────────────────────────────────────────────────────────────────
  // Derived Data
  // ───────────────────────────────────────────────────────────────────────────

  const { chartData: singleChartData, stats } = useMemo(() => {
    if (singleState.status !== "success") {
      return {
        chartData: [] as ChartPoint[],
        stats: null as ReturnType<typeof computeStats> | null,
      };
    }

    const rangeSeries = filterByRange(singleState.data.series, range);

    const chartPoints: ChartPoint[] = rangeSeries.map((point) => ({
      date: point.date,
      close: point.close,
    }));

    const statsResult =
      rangeSeries.length > 0 ? computeStats(rangeSeries) : null;

    return {
      chartData: chartPoints,
      stats: statsResult,
    };
  }, [singleState, range]);

  const { multiChartData, multiSymbols } = useMemo(() => {
    if (multiState.status !== "success") {
      return {
        multiChartData: [] as MultiChartRow[],
        multiSymbols: [] as string[],
      };
    }

    // Filter to only symbols we have data for
    const availableSymbols = multiSelectedSymbols.filter(
      (sym) => multiState.data[sym] !== undefined,
    );

    // Normalize each stock's prices relative to first value in range
    const normalizedSeries: Record<string, { date: string; value: number }[]> =
      {};

    for (const sym of availableSymbols) {
      const series = multiState.data[sym].series;
      const rangeSeries = filterByRange(series, range);

      if (rangeSeries.length === 0) continue;

      const basePrice = rangeSeries[0].close;
      if (basePrice === 0 || !Number.isFinite(basePrice)) continue;

      normalizedSeries[sym] = rangeSeries.map((point) => ({
        date: point.date,
        value: point.close / basePrice,
      }));
    }

    // Collect all unique dates and sort them
    const allDates = new Set<string>();
    for (const series of Object.values(normalizedSeries)) {
      for (const point of series) {
        allDates.add(point.date);
      }
    }
    const sortedDates = Array.from(allDates).sort();

    // Build chart rows with all symbols' values for each date
    const rows: MultiChartRow[] = sortedDates.map((date) => {
      const row: MultiChartRow = { date };

      for (const sym of availableSymbols) {
        const series = normalizedSeries[sym];
        if (!series) continue;

        const point = series.find((p) => p.date === date);
        if (point) {
          row[sym] = point.value;
        }
      }

      return row;
    });

    return {
      multiChartData: rows,
      multiSymbols: availableSymbols,
    };
  }, [multiState, multiSelectedSymbols, range]);

  // Compute correlation matrix from multi-stock data
  // Always includes SPY (S&P 500) as a benchmark for market correlation
  const correlationMatrix = useMemo((): CorrelationMatrix | null => {
    if (multiState.status !== "success") {
      return null;
    }

    // Prepare data for correlation calculation
    // Always include SPY for market benchmark correlation
    const seriesBySymbol: Record<string, { date: string; close: number }[]> = {};

    // Include SPY first as the benchmark
    const spySeries = multiState.data[SP500_INDEX.symbol]?.series;
    if (spySeries) {
      const rangeSeries = filterByRange(spySeries, range);
      seriesBySymbol[SP500_INDEX.symbol] = rangeSeries.map((point) => ({
        date: point.date,
        close: point.close,
      }));
    }

    // Add selected symbols
    for (const sym of multiSymbols) {
      if (sym === SP500_INDEX.symbol) continue; // Already added
      const series = multiState.data[sym]?.series;
      if (!series) continue;

      const rangeSeries = filterByRange(series, range);
      seriesBySymbol[sym] = rangeSeries.map((point) => ({
        date: point.date,
        close: point.close,
      }));
    }

    // Need at least 2 symbols (SPY + 1 stock) for correlation
    if (Object.keys(seriesBySymbol).length < 2) {
      return null;
    }

    return computeCorrelationMatrix(seriesBySymbol);
  }, [multiState, multiSymbols, range]);

  // ───────────────────────────────────────────────────────────────────────────
  // Derived State Flags
  // ───────────────────────────────────────────────────────────────────────────

  const isSingleLoading = singleState.status === "loading";
  const isSingleError = singleState.status === "error";
  const isMultiLoading = multiState.status === "loading";
  const isMultiError = multiState.status === "error";

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  const timeRangeOptions: TimeRange[] = ["1M", "3M", "6M", "1Y", "MAX"];

  return (
    <div className="flex flex-col gap-8">
      {/* Header with controls */}
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Nasdaq Stock Dashboard</h1>
          <p className="text-sm text-neutral-400">
            Track daily prices, basic risk/return metrics, and compare relative
            performance across selected tickers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StockSelector
            selectedSymbol={symbol}
            onChange={setSymbol}
            disabled={isSingleLoading}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Range</span>
            <div className="flex gap-1 rounded-lg border border-neutral-700 bg-neutral-900 p-1 text-xs">
              {timeRangeOptions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`rounded-md px-2 py-1 ${
                    r === range
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Loading indicator for single stock */}
      {isSingleLoading && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          Loading data for <span className="font-semibold">{symbol}</span>…
        </div>
      )}

      {/* Error message for single stock */}
      {isSingleError && singleState.status === "error" && (
        <div className="rounded-xl border border-red-800 bg-red-950 p-4 text-sm text-red-100">
          <p className="font-semibold">Error loading data</p>
          <p className="mt-1">{singleState.error}</p>
          <p className="mt-2 text-xs text-red-200">
            This can happen if the API rate limit is hit or the symbol is
            temporarily unavailable. Try again in a minute.
          </p>
        </div>
      )}

      {/* Price chart section */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-2 text-lg font-medium">
          {singleState.status === "success"
            ? `${singleState.data.symbol} — Price History`
            : "Price History"}
        </h2>
        {singleChartData.length > 0 ? (
          <StockChart data={singleChartData} />
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
            {isSingleLoading
              ? "Fetching time series…"
              : "No data available for this selection."}
          </div>
        )}
      </section>

      {/* Statistics section */}
      <section>
        <h2 className="mb-2 text-lg font-medium">Risk and Return Metrics</h2>
        {stats ? (
          <StatsCards stats={stats} />
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
            Not enough data to compute statistics for this selection.
          </div>
        )}
      </section>

      {/* Multi-stock comparison section */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-medium">Multi-stock comparison</h2>
            <p className="text-xs text-neutral-400">
              Lines are normalised to 1 at the start of the selected range to
              show relative performance.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <MultiStockSelector
              selectedSymbols={multiSelectedSymbols}
              onChange={setMultiSelectedSymbols}
              maxSelected={4}
              disabled={isMultiLoading}
            />
          </div>
        </div>

        {isMultiLoading && (
          <div className="mb-3 rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-300">
            Loading comparison data for selected tickers…
          </div>
        )}

        {isMultiError && multiState.status === "error" && (
          <div className="mb-3 rounded-lg border border-red-800 bg-red-950 p-3 text-xs text-red-100">
            <p className="font-semibold">Error loading comparison data</p>
            <p className="mt-1">{multiState.error}</p>
          </div>
        )}

        <MultiStockChart data={multiChartData} symbols={multiSymbols} />
      </section>

      {/* Correlation Matrix section */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-4">
          <h2 className="text-lg font-medium">Correlation Matrix</h2>
          <p className="text-xs text-neutral-400">
            Pearson correlation of daily log-returns for the selected time range.
            SPY (S&amp;P 500) is always included as a market benchmark.
          </p>
        </div>

        {isMultiLoading && (
          <div className="flex h-32 items-center justify-center text-sm text-neutral-400">
            Loading correlation data…
          </div>
        )}

        {!isMultiLoading && multiSymbols.length < 1 && (
          <div className="flex h-32 items-center justify-center text-sm text-neutral-400">
            Select at least 1 ticker to see the correlation with the S&amp;P 500.
          </div>
        )}

        {!isMultiLoading && correlationMatrix && (
          <CorrelationHeatmap matrix={correlationMatrix} />
        )}
      </section>
    </div>
  );
}
