"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { StockSelector } from "@/components/StockSelector";
import { StockChart } from "@/components/StockChart";
import { StatsCards } from "@/components/StatsCards";
import {
  computeStats,
  computeCorrelationMatrix,
  computeRollingVolatility,
  computeRollingReturn,
  computeDrawdown,
  getDailyLogReturns,
  computeReturnDistribution,
  computeHigherMoments,
  computeSharpeRatio,
} from "@/lib/stats";
import type {
  CorrelationMatrix,
  RollingVolatilityPoint,
  RollingReturnPoint,
  DrawdownPoint,
  DailyLogReturn,
  ReturnDistributionBin,
  HigherMoments,
} from "@/lib/stats";
import { MultiStockSelector } from "@/components/MultiStockSelector";
import { MultiStockChart } from "@/components/MultiStockChart";
import { CorrelationHeatmap } from "@/components/CorrelationHeatmap";
import { RollingVolChart } from "@/components/RollingVolChart";
import { RollingReturnChart } from "@/components/RollingReturnChart";
import { DrawdownChart } from "@/components/DrawdownChart";
import { ReturnHistogram } from "@/components/ReturnHistogram";
import { RiskMetricsPanel } from "@/components/RiskMetricsPanel";
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
import { useDashboardSearchParams } from "@/lib/useDashboardSearchParams";

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
  // URL-driven State
  // ───────────────────────────────────────────────────────────────────────────

  // Symbol and range are persisted in the URL query string
  const { symbol, range, setSymbol, setRange } = useDashboardSearchParams();

  // ───────────────────────────────────────────────────────────────────────────
  // Local State
  // ───────────────────────────────────────────────────────────────────────────

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

  // Advanced analytics state
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<
    "vol21" | "vol63" | "ret21" | "drawdown"
  >("vol21");

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

  const { chartData: singleChartData, stats, rangeSeries } = useMemo(() => {
    if (singleState.status !== "success") {
      return {
        chartData: [] as ChartPoint[],
        stats: null as ReturnType<typeof computeStats> | null,
        rangeSeries: [] as StockTimeSeriesPoint[],
      };
    }

    const filtered = filterByRange(singleState.data.series, range);

    const chartPoints: ChartPoint[] = filtered.map((point) => ({
      date: point.date,
      close: point.close,
    }));

    const statsResult =
      filtered.length > 0 ? computeStats(filtered) : null;

    return {
      chartData: chartPoints,
      stats: statsResult,
      rangeSeries: filtered,
    };
  }, [singleState, range]);

  // Compute advanced analytics (rolling volatility, returns, drawdown)
  const advancedAnalytics = useMemo(() => {
    if (rangeSeries.length === 0) {
      return {
        rollingVol21: [] as RollingVolatilityPoint[],
        rollingVol63: [] as RollingVolatilityPoint[],
        rollingRet21: [] as RollingReturnPoint[],
        drawdown: [] as DrawdownPoint[],
      };
    }

    return {
      rollingVol21: computeRollingVolatility(rangeSeries, 21),
      rollingVol63: computeRollingVolatility(rangeSeries, 63),
      rollingRet21: computeRollingReturn(rangeSeries, 21),
      drawdown: computeDrawdown(rangeSeries),
    };
  }, [rangeSeries]);

  // Compute return distribution and risk metrics
  const returnDistribution = useMemo(() => {
    const dailyReturns = getDailyLogReturns(rangeSeries);

    if (dailyReturns.length === 0) {
      return {
        dailyReturns: [] as DailyLogReturn[],
        histogram: [] as ReturnDistributionBin[],
        moments: { mean: NaN, std: NaN, skewness: NaN, kurtosis: NaN } as HigherMoments,
        sharpeRatio: null as number | null,
      };
    }

    return {
      dailyReturns,
      histogram: computeReturnDistribution(dailyReturns, 35),
      moments: computeHigherMoments(dailyReturns),
      sharpeRatio: computeSharpeRatio(dailyReturns),
    };
  }, [rangeSeries]);

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
    <div className="flex flex-col gap-6">
      {/* Header with controls */}
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nasdaq Stock Dashboard
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Track daily prices, risk/return metrics, and compare relative
            performance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StockSelector
            selectedSymbol={symbol}
            onChange={setSymbol}
            disabled={isSingleLoading}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-400">Range</span>
            <div className="flex rounded-lg border border-neutral-700 bg-neutral-900/50 p-0.5">
              {timeRangeOptions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    r === range
                      ? "bg-neutral-100 text-neutral-900 shadow-sm"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
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
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300">
          Loading data for <span className="font-semibold">{symbol}</span>…
        </div>
      )}

      {/* Error message for single stock */}
      {isSingleError && singleState.status === "error" && (
        <div className="rounded-2xl border border-red-900/50 bg-red-950/50 p-4 text-sm text-red-100">
          <p className="font-semibold">Error loading data</p>
          <p className="mt-1 text-red-200">{singleState.error}</p>
          <p className="mt-2 text-xs text-red-300">
            This can happen if the API rate limit is hit or the symbol is
            temporarily unavailable. Try again in a minute.
          </p>
        </div>
      )}

      {/* Price chart and stats - side by side on larger screens */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Price chart section - takes 2/3 on large screens */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 lg:col-span-2">
          <h2 className="mb-3 text-base font-medium text-neutral-200">
            {singleState.status === "success"
              ? `${singleState.data.symbol} — Price History`
              : "Price History"}
          </h2>
          {singleChartData.length > 0 ? (
            <StockChart data={singleChartData} />
          ) : (
            <div className="flex h-72 items-center justify-center text-sm text-neutral-500">
              {isSingleLoading
                ? "Fetching time series…"
                : "No data available for this selection."}
            </div>
          )}
        </section>

        {/* Statistics section - takes 1/3 on large screens */}
        <section className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
          <h2 className="mb-3 text-base font-medium text-neutral-200">
            Risk &amp; Return
          </h2>
          {stats ? (
            <StatsCards stats={stats} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
              Not enough data to compute statistics.
            </div>
          )}
        </section>
      </div>

      {/* Return Distribution & Risk Profile */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Histogram - takes 3/5 on large screens */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 lg:col-span-3">
          <div className="mb-3">
            <h2 className="text-base font-medium text-neutral-200">
              Return Distribution
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Histogram of daily log returns over selected range.
            </p>
          </div>
          {isSingleLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
              Loading return data…
            </div>
          ) : (
            <ReturnHistogram data={returnDistribution.histogram} />
          )}
        </section>

        {/* Risk Metrics - takes 2/5 on large screens */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 lg:col-span-2">
          <div className="mb-3">
            <h2 className="text-base font-medium text-neutral-200">
              Risk Profile
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Distribution moments and risk-adjusted metrics.
            </p>
          </div>
          {isSingleLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
              Loading risk metrics…
            </div>
          ) : returnDistribution.dailyReturns.length > 0 ? (
            <RiskMetricsPanel
              moments={returnDistribution.moments}
              sharpeRatio={returnDistribution.sharpeRatio}
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
              Insufficient data for risk metrics.
            </div>
          )}
        </section>
      </div>

      {/* Advanced Time-Series Analytics - Collapsible Section */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50">
        <button
          type="button"
          onClick={() => setAnalyticsOpen(!analyticsOpen)}
          className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-neutral-800/30"
        >
          <div>
            <h2 className="text-base font-medium text-neutral-200">
              Advanced Time-Series Analytics
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Rolling volatility, returns, and drawdown analysis.
            </p>
          </div>
          <span
            className={`text-neutral-400 transition-transform ${
              analyticsOpen ? "rotate-180" : ""
            }`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        </button>

        {analyticsOpen && (
          <div className="border-t border-neutral-800 p-5 pt-4">
            {/* Tab Navigation */}
            <div className="mb-4 flex flex-wrap gap-2">
              {(
                [
                  { key: "vol21", label: "21d Volatility" },
                  { key: "vol63", label: "63d Volatility" },
                  { key: "ret21", label: "21d Returns" },
                  { key: "drawdown", label: "Drawdown" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAnalyticsTab(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    analyticsTab === key
                      ? "bg-neutral-700 text-neutral-100"
                      : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Chart Content */}
            {isSingleLoading ? (
              <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
                Loading analytics data…
              </div>
            ) : (
              <>
                {analyticsTab === "vol21" && (
                  <div>
                    <p className="mb-2 text-xs text-neutral-500">
                      21-day rolling annualized volatility (std dev of log returns × √252).
                    </p>
                    <RollingVolChart
                      data={advancedAnalytics.rollingVol21}
                      windowDays={21}
                    />
                  </div>
                )}
                {analyticsTab === "vol63" && (
                  <div>
                    <p className="mb-2 text-xs text-neutral-500">
                      63-day rolling annualized volatility (approx. 3 months).
                    </p>
                    <RollingVolChart
                      data={advancedAnalytics.rollingVol63}
                      windowDays={63}
                    />
                  </div>
                )}
                {analyticsTab === "ret21" && (
                  <div>
                    <p className="mb-2 text-xs text-neutral-500">
                      21-day trailing simple returns (current price vs. 21 days ago).
                    </p>
                    <RollingReturnChart
                      data={advancedAnalytics.rollingRet21}
                      windowDays={21}
                    />
                  </div>
                )}
                {analyticsTab === "drawdown" && (
                  <div>
                    <p className="mb-2 text-xs text-neutral-500">
                      Drawdown from running peak (0% = new high, negative = below peak).
                    </p>
                    <DrawdownChart data={advancedAnalytics.drawdown} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Multi-stock comparison and correlation - side by side on larger screens */}
      <div className="grid gap-6 xl:grid-cols-5">
        {/* Multi-stock comparison section */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 xl:col-span-3">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-medium text-neutral-200">
                Multi-Stock Comparison
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Normalized to 1 at range start for relative performance.
              </p>
            </div>
            <div className="w-full sm:w-56">
              <MultiStockSelector
                selectedSymbols={multiSelectedSymbols}
                onChange={setMultiSelectedSymbols}
                maxSelected={4}
                disabled={isMultiLoading}
              />
            </div>
          </div>

          {isMultiLoading && (
            <div className="mb-3 rounded-xl border border-neutral-700/50 bg-neutral-950/50 p-3 text-xs text-neutral-400">
              Loading comparison data for selected tickers…
            </div>
          )}

          {isMultiError && multiState.status === "error" && (
            <div className="mb-3 rounded-xl border border-red-900/50 bg-red-950/50 p-3 text-xs text-red-200">
              <p className="font-semibold">Error loading comparison data</p>
              <p className="mt-1">{multiState.error}</p>
            </div>
          )}

          <MultiStockChart data={multiChartData} symbols={multiSymbols} />
        </section>

        {/* Correlation Matrix section */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 xl:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-medium text-neutral-200">
              Correlation Matrix
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Daily log-return correlations. SPY included as benchmark.
            </p>
          </div>

          {isMultiLoading && (
            <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
              Loading correlation data…
            </div>
          )}

          {!isMultiLoading && multiSymbols.length < 1 && (
            <div className="flex h-48 items-center justify-center text-center text-sm text-neutral-500">
              Select at least 1 ticker to see
              <br />
              correlation with S&amp;P 500.
            </div>
          )}

          {!isMultiLoading && correlationMatrix && (
            <CorrelationHeatmap matrix={correlationMatrix} />
          )}
        </section>
      </div>
    </div>
  );
}
