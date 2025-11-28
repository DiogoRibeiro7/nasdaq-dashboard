"use client";

import { useEffect, useMemo, useState } from "react";
import { StockSelector } from "@/components/StockSelector";
import { StockChart } from "@/components/StockChart";
import { StatsCards } from "@/components/StatsCards";
import { computeStats } from "@/lib/stats";
import { MultiStockSelector } from "@/components/MultiStockSelector";
import { MultiStockChart, type MultiChartRow } from "@/components/MultiStockChart";

type TimeRange = "1M" | "3M" | "6M" | "1Y" | "MAX";

type StockApiPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
};

type StockApiResponse = {
  symbol: string;
  lastRefreshed: string;
  series: StockApiPoint[];
};

type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

/**
 * Filter a time series by a time range, approximated in trading days.
 */
function filterByRange(
  series: StockApiPoint[],
  range: TimeRange,
): StockApiPoint[] {
  if (range === "MAX") return series;

  const daysMap: Record<Exclude<TimeRange, "MAX">, number> = {
    "1M": 21,
    "3M": 63,
    "6M": 126,
    "1Y": 252,
  };

  const days = daysMap[range];
  if (series.length <= days) return series;

  return series.slice(series.length - days);
}

/**
 * Client-side dashboard that:
 *  - allows selecting a primary ticker and time range,
 *  - fetches data for that ticker and shows chart + stats,
 *  - allows selecting multiple tickers for a relative performance chart.
 */
export function StockDashboard() {
  const [symbol, setSymbol] = useState<string>("AAPL");
  const [range, setRange] = useState<TimeRange>("3M");

  const [singleState, setSingleState] = useState<
    FetchState<StockApiResponse>
  >({ status: "idle" });

  const [multiSelectedSymbols, setMultiSelectedSymbols] = useState<string[]>([
    "AAPL",
    "MSFT",
    "GOOGL",
  ]);

  const [multiState, setMultiState] = useState<
    FetchState<Record<string, StockApiResponse>>
  >({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setSingleState({ status: "loading" });

      try {
        const res = await fetch(`/api/stocks/${symbol}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          const msg =
            body?.error ?? `Request failed with status ${res.status}`;
          if (!cancelled) {
            setSingleState({ status: "error", error: msg });
          }
          return;
        }

        const json = (await res.json()) as StockApiResponse;
        if (!cancelled) {
          setSingleState({ status: "success", data: json });
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unexpected error while fetching stock data";
        if (!cancelled) {
          setSingleState({ status: "error", error: msg });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    if (multiSelectedSymbols.length === 0) {
      setMultiState({ status: "idle" });
      return;
    }

    let cancelled = false;

    async function loadMulti() {
      setMultiState({ status: "loading" });

      try {
        const responses = await Promise.all(
          multiSelectedSymbols.map(async (sym) => {
            const res = await fetch(`/api/stocks/${sym}`);
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as
                | { error?: string }
                | null;
              const msg =
                body?.error ?? `Request failed with status ${res.status}`;
              throw new Error(msg);
            }

            const json = (await res.json()) as StockApiResponse;
            return [sym, json] as const;
          }),
        );

        if (cancelled) return;

        const map: Record<string, StockApiResponse> = {};
        for (const [sym, data] of responses) {
          map[sym] = data;
        }

        setMultiState({ status: "success", data: map });
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : "Unexpected error while fetching comparison data";
        setMultiState({ status: "error", error: msg });
      }
    }

    loadMulti();

    return () => {
      cancelled = true;
    };
  }, [multiSelectedSymbols]);

  const {
    chartData: singleChartData,
    stats,
  } = useMemo(() => {
    if (singleState.status !== "success") {
      return {
        chartData: [] as { date: string; close: number }[],
        stats: null as ReturnType<typeof computeStats> | null,
      };
    }

    const rangeSeries = filterByRange(singleState.data.series, range);

    const chartPoints = rangeSeries.map((p) => ({
      date: p.date,
      close: p.close,
    }));

    const statsObj =
      rangeSeries.length > 0 ? computeStats(rangeSeries) : null;

    return {
      chartData: chartPoints,
      stats: statsObj,
    };
  }, [singleState, range]);

  const { multiChartData, multiSymbols } = useMemo(() => {
    if (multiState.status !== "success") {
      return {
        multiChartData: [] as MultiChartRow[],
        multiSymbols: [] as string[],
      };
    }

    const symbols = multiSelectedSymbols.filter(
      (sym) => multiState.data[sym] !== undefined,
    );

    const normalized: Record<
      string,
      { date: string; value: number }[]
    > = {};

    symbols.forEach((sym) => {
      const series = multiState.data[sym].series;
      const rangeSeries = filterByRange(series, range);
      if (rangeSeries.length === 0) return;
      const base = rangeSeries[0].close;
      if (base === 0) return;

      normalized[sym] = rangeSeries.map((p) => ({
        date: p.date,
        value: p.close / base,
      }));
    });

    const dateSet = new Set<string>();
    Object.values(normalized).forEach((series) => {
      series.forEach((p) => dateSet.add(p.date));
    });
    const dates = Array.from(dateSet).sort();

    const rows: MultiChartRow[] = dates.map((date) => {
      const row: MultiChartRow = { date };
      symbols.forEach((sym) => {
        const series = normalized[sym];
        if (!series) return;
        const point = series.find((p) => p.date === date);
        if (point) {
          // eslint-disable-next-line no-param-reassign
          (row as any)[sym] = point.value;
        }
      });
      return row;
    });

    return {
      multiChartData: rows,
      multiSymbols: symbols,
    };
  }, [multiState, multiSelectedSymbols, range]);

  const isSingleLoading = singleState.status === "loading";
  const isSingleError = singleState.status === "error";
  const isMultiLoading = multiState.status === "loading";
  const isMultiError = multiState.status === "error";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold">
            Nasdaq Stock Dashboard
          </h1>
          <p className="text-sm text-neutral-400">
            Track daily prices, basic risk/return metrics, and compare
            relative performance across selected tickers.
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
              {(["1M", "3M", "6M", "1Y", "MAX"] as TimeRange[]).map(
                (r) => {
                  const active = r === range;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRange(r)}
                      className={`rounded-md px-2 py-1 ${
                        active
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-300 hover:bg-neutral-800"
                      }`}
                    >
                      {r}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>
      </header>

      {isSingleLoading && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
          Loading data for <span className="font-semibold">{symbol}</span>…
        </div>
      )}

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

      <section>
        <h2 className="mb-2 text-lg font-medium">
          Risk and Return Metrics
        </h2>
        {stats ? (
          <StatsCards stats={stats} />
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
            Not enough data to compute statistics for this selection.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-medium">
              Multi-stock comparison
            </h2>
            <p className="text-xs text-neutral-400">
              Lines are normalised to 1 at the start of the selected range
              to show relative performance.
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

        <MultiStockChart
          data={multiChartData}
          symbols={multiSymbols}
        />
      </section>
    </div>
  );
}
