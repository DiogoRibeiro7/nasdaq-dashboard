"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  computeRollingCorrelation,
  computeDualMovingAverages,
  computeCapmStats,
  detectGaps,
  detectVolumeSpikes,
  detectMovingAverageCrossovers,
  backtestMaCrossoverStrategy,
  backtestBuyAndHold,
  computeRsi,
  computeMacd,
  classifyRegimes,
  computePortfolioSeries,
  computePortfolioMetrics,
  computeAcf,
  computeLjungBox,
  computeDayOfWeekSeasonality,
  computeMonthOfYearSeasonality,
} from "@/lib/stats";
import { forecastPrices, type ForecastModelType } from "@/lib/analytics/forecast";
import type {
  PortfolioPoint,
  CorrelationMatrix,
  RollingVolatilityPoint,
  RollingReturnPoint,
  DrawdownPoint,
  DailyLogReturn,
  ReturnDistributionBin,
  HigherMoments,
  RollingCorrelationPoint,
  CapmStats,
  BacktestResult,
  PricePoint,
  CalendarBucketStats,
  CrossSectionMetrics,
  DatedReturn,
} from "@/lib/stats";
import { MultiStockSelector } from "@/components/MultiStockSelector";
import { MultiStockChart } from "@/components/MultiStockChart";
import { CorrelationHeatmap } from "@/components/CorrelationHeatmap";
import { RollingVolChart } from "@/components/RollingVolChart";
import { RollingReturnChart } from "@/components/RollingReturnChart";
import { DrawdownChart } from "@/components/DrawdownChart";
import { ReturnHistogram } from "@/components/ReturnHistogram";
import { RiskMetricsPanel } from "@/components/RiskMetricsPanel";
import { MultiRollingCorrelationChart } from "@/components/MultiRollingCorrelationChart";
import { CapmPanel } from "@/components/CapmPanel";
import { MaTrendChart } from "@/components/MaTrendChart";
import { BacktestSummary } from "@/components/BacktestSummary";
import { EquityCurveChart } from "@/components/EquityCurveChart";
import { RsiChart } from "@/components/RsiChart";
import { MacdChart } from "@/components/MacdChart";
import { RegimeTimeline } from "@/components/RegimeTimeline";
import { PortfolioChart } from "@/components/PortfolioChart";
import { PortfolioStatsPanel } from "@/components/PortfolioStatsPanel";
import { EfficientFrontierChart } from "@/components/EfficientFrontierChart";
import { PortfolioWeightsTable } from "@/components/PortfolioWeightsTable";
import { StrategyComparisonTable } from "@/components/StrategyComparisonTable";
import { AcfChart } from "@/components/AcfChart";
import { LjungBoxTable } from "@/components/LjungBoxTable";
import { SeasonalityBars } from "@/components/SeasonalityBars";
import { GlossaryTooltip } from "@/components/GlossaryTooltip";
import { GlossaryPanel } from "@/components/GlossaryPanel";
import { CrossSectionTable } from "@/components/CrossSectionTable";
import { ForecastChart } from "@/components/ForecastChart";
import { VarEsPanel } from "@/components/VarEsPanel";
import { PcaExplainedVarianceChart } from "@/components/PcaExplainedVarianceChart";
import { PcaLoadingsTable } from "@/components/PcaLoadingsTable";
import type {
  ChartPoint,
  FetchState,
  MultiChartRow,
  StockAnalyticsSnapshot,
  StockApiResponse,
  StockTimeSeriesPoint,
  TimeRange,
} from "@/lib/types";
import { TIME_RANGE_DAYS } from "@/lib/types";
import { formatAxisNumber, formatPercent } from "@/lib/format";
import {
  DEFAULT_BENCHMARK_SYMBOL,
  getSymbolDisplayName,
  NASDAQ_STOCKS,
} from "@/lib/stocks";
import { useDashboardSearchParams } from "@/lib/useDashboardSearchParams";
import {
  computeCrossSectionMetrics,
  type SymbolSeriesMap,
} from "@/lib/crossSection";
import { computeReturnPca, type PcaResult } from "@/lib/analytics/pca";
import {
  backtestSignals,
  generateMaCrossoverSignals,
  generateRegimeFilterSignals,
  generateRsiBandSignals,
} from "@/lib/analytics/backtest";
import { computeVarEs } from "@/lib/analytics/risk";
import {
  computeEfficientFrontier,
  findMaxSharpePortfolio,
  findMinVariancePortfolio,
  type FrontierPoint,
  type OptimisationInputs,
} from "@/lib/analytics/portfolio_opt";

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

function formatPercentOrDash(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return formatPercent(value);
}

function formatNumberOrDash(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return formatAxisNumber(value);
}

function computePointSharpe(
  point: FrontierPoint | null,
  riskFreeRate: number,
): number | null {
  if (!point || point.volatility <= 0) {
    return null;
  }
  return (point.expectedReturn - riskFreeRate) / point.volatility;
}

function sanitizeShortWindow(value: number, currentLong: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SHORT_WINDOW;
  const maxAllowed = Math.max(
    MIN_MA_WINDOW,
    Math.min(currentLong - 1, MAX_MA_WINDOW - 1),
  );
  return Math.min(Math.max(MIN_MA_WINDOW, Math.trunc(value)), maxAllowed);
}

function sanitizeLongWindow(value: number, currentShort: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LONG_WINDOW;
  const minAllowed = Math.max(currentShort + 1, MIN_MA_WINDOW + 1);
  const clamped = Math.max(minAllowed, Math.trunc(value));
  return Math.min(clamped, MAX_MA_WINDOW);
}

const EMPTY_BACKTEST_RESULT: BacktestResult = {
  trades: [],
  equityCurve: [],
  totalReturn: 0,
  maxDrawdown: 0,
  cagr: null,
};

const MAX_MA_WINDOW = 250;

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

type AnalyticsSnapshotInput = {
  symbol: string;
  range: TimeRange;
  stats: ReturnType<typeof computeStats> | null;
  rangeSeries: StockTimeSeriesPoint[];
  rollingVol21: RollingVolatilityPoint[];
  rollingVol63: RollingVolatilityPoint[];
  rollingRet21: RollingReturnPoint[];
  drawdownSeries: DrawdownPoint[];
  sharpeRatio: number | null;
  higherMoments: HigherMoments;
  histogram: ReturnDistributionBin[];
};

function buildAnalyticsSnapshot({
  symbol,
  range,
  stats,
  rangeSeries,
  rollingVol21,
  rollingVol63,
  rollingRet21,
  drawdownSeries,
  sharpeRatio,
  higherMoments,
  histogram,
}: AnalyticsSnapshotInput): StockAnalyticsSnapshot {
  let maxDrawdown: number | null = null;
  let maxDrawdownDate: string | null = null;

  for (const point of drawdownSeries) {
    if (maxDrawdown === null || point.peakToTrough < maxDrawdown) {
      maxDrawdown = point.peakToTrough;
      maxDrawdownDate = point.date;
    }
  }

  return {
    symbol,
    range,
    generatedAt: new Date().toISOString(),
    summary: stats,
    rollingMetrics: {
      volatility21: rollingVol21,
      volatility63: rollingVol63,
      return21: rollingRet21,
    },
    drawdown: {
      series: drawdownSeries,
      maxDrawdown,
      maxDrawdownDate,
    },
    risk: {
      sharpeRatio,
      higherMoments,
      histogram,
    },
    priceSeries: rangeSeries,
  };
}

type ScreenerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | {
      status: "success";
      data: { metrics: CrossSectionMetrics[]; pca: PcaResult | null };
    };

type CsvBuildContext = {
  rangeSeries: StockTimeSeriesPoint[];
  dailyReturns: DailyLogReturn[];
  rollingVol21: RollingVolatilityPoint[];
  rollingVol63: RollingVolatilityPoint[];
  rollingRet21: RollingReturnPoint[];
  drawdown: DrawdownPoint[];
};

function buildCsvContent({
  rangeSeries,
  dailyReturns,
  rollingVol21,
  rollingVol63,
  rollingRet21,
  drawdown,
}: CsvBuildContext): string {
  const logReturnMap = new Map(dailyReturns.map((item) => [item.date, item.r]));
  const rollingVol21Map = new Map(
    rollingVol21.map((item) => [item.date, item.vol]),
  );
  const rollingVol63Map = new Map(
    rollingVol63.map((item) => [item.date, item.vol]),
  );
  const rollingRet21Map = new Map(
    rollingRet21.map((item) => [item.date, item.ret]),
  );
  const drawdownMap = new Map(drawdown.map((item) => [item.date, item]));

  const header = [
    "date",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "log_return",
    "rolling_vol_21",
    "rolling_vol_63",
    "rolling_return_21",
    "drawdown",
    "peak_to_trough",
  ];

  const rows = rangeSeries.map((point) => {
    const drawdownPoint = drawdownMap.get(point.date);
    return [
      point.date,
      point.open,
      point.high,
      point.low,
      point.close,
      point.volume,
      logReturnMap.get(point.date) ?? "",
      rollingVol21Map.get(point.date) ?? "",
      rollingVol63Map.get(point.date) ?? "",
      rollingRet21Map.get(point.date) ?? "",
      drawdownPoint?.drawdown ?? "",
      drawdownPoint?.peakToTrough ?? "",
    ];
  });

  const lines = [header, ...rows].map((row) =>
    row.map(formatCsvValue).join(","),
  );

  return lines.join("\n");
}

function formatCsvValue(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "";
  }

  if (typeof value === "number") {
    return value.toString();
  }

  const needsEscaping = value.includes(",") || value.includes('"');
  if (needsEscaping) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

const EMPTY_CAPM_STATS: CapmStats = {
  beta: null,
  alphaDaily: null,
  alphaAnnual: null,
  r2: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client-side dashboard for viewing stock data.
 *
 * Features:
 * - Single stock selection with price chart and statistics
 * - Configurable time range (5D, 10D, 1M, 3M, 6M, 1Y, MAX)
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

  const [benchmarkState, setBenchmarkState] =
    useState<FetchState<StockApiResponse>>({ status: "idle" });

  // Advanced analytics state
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<
    "vol21" | "vol63" | "ret21" | "drawdown"
  >("vol21");

  // Rolling correlation window state
  const [correlationWindow, setCorrelationWindow] = useState<21 | 63 | 126>(63);

  // Event detection thresholds
  const [gapThreshold, setGapThreshold] = useState(0.03);
  const [volumeZThreshold, setVolumeZThreshold] = useState(2);

  // Moving average window state for trend analysis
  const [shortWindow, setShortWindow] = useState(DEFAULT_SHORT_WINDOW);
  const [longWindow, setLongWindow] = useState(DEFAULT_LONG_WINDOW);
  const [rsiPeriod, setRsiPeriod] = useState(DEFAULT_RSI_PERIOD);
  const [macdFast, setMacdFast] = useState(DEFAULT_MACD_FAST);
  const [macdSlow, setMacdSlow] = useState(DEFAULT_MACD_SLOW);
  const [macdSignal, setMacdSignal] = useState(DEFAULT_MACD_SIGNAL);
  const [volThresholdHigh, setVolThresholdHigh] = useState(0.35);
  const [screenerState, setScreenerState] = useState<ScreenerState>({
    status: "idle",
  });
  const [screenerSort, setScreenerSort] = useState<{
    key: keyof CrossSectionMetrics;
    dir: "asc" | "desc";
  }>({
    key: "return3M",
    dir: "desc",
  });
  const [screenerTopN, setScreenerTopN] = useState(10);
  const [forecastModel, setForecastModel] =
    useState<ForecastModelType>("naive");
  const [forecastHorizon, setForecastHorizon] = useState(10);
  const [tailConfidence, setTailConfidence] = useState(0.95);
  const [tailHorizon, setTailHorizon] = useState(1);

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
  useEffect(() => {
    if (multiSelectedSymbols.length === 0) {
      setMultiState({ status: "idle" });
      return;
    }

    let cancelled = false;

    async function loadMultipleStocks(): Promise<void> {
      setMultiState({ status: "loading" });

      const symbolsToFetch = multiSelectedSymbols;

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

  // Fetch benchmark data (e.g., QQQ) once for CAPM analytics
  useEffect(() => {
    let cancelled = false;

    async function loadBenchmark(): Promise<void> {
      setBenchmarkState({ status: "loading" });

      try {
        const response = await fetch(`/api/stocks/${DEFAULT_BENCHMARK_SYMBOL}`);

        if (!response.ok) {
          const errorMessage = await extractErrorMessage(response);
          throw new Error(errorMessage);
        }

        const data = (await response.json()) as StockApiResponse;
        if (!cancelled) {
          setBenchmarkState({ status: "success", data });
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Unexpected error while fetching benchmark data";
        setBenchmarkState({ status: "error", error: message });
      }
    }

    void loadBenchmark();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const priceSeries = useMemo<PricePoint[]>(() => {
    if (rangeSeries.length === 0) {
      return [];
    }

    return rangeSeries.map((point) => ({
      date: point.date,
      close: point.close,
    }));
  }, [rangeSeries]);

  const insufficientMaData =
    priceSeries.length > 0 && priceSeries.length < longWindow;

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

  const dailyReturnCount = returnDistribution.dailyReturns.length;

  const acfReturns = useMemo(
    () => computeAcf(returnDistribution.dailyReturns, 20),
    [returnDistribution.dailyReturns],
  );

  const acfAbsReturns = useMemo(() => {
    const transformed = returnDistribution.dailyReturns.map((point) => ({
      date: point.date,
      r: Math.abs(point.r),
    }));
    return computeAcf(transformed, 20);
  }, [returnDistribution.dailyReturns]);

  const ljungBoxResults = useMemo(
    () => computeLjungBox(returnDistribution.dailyReturns, 20),
    [returnDistribution.dailyReturns],
  );

  const serialDependenceSummary = useMemo(() => {
    const hasReturnAutocorr = acfReturns
      .filter((point) => point.lag > 0 && point.lag <= 5)
      .some((point) => Math.abs(point.value) > 0.2);

    const hasVolClustering = acfAbsReturns
      .filter((point) => point.lag > 0 && point.lag <= 5)
      .some((point) => point.value > 0.2);

    const hasSignificantLjung =
      ljungBoxResults.some(
        (result) => result.pValue !== null && result.pValue < 0.05,
      );

    if (hasSignificantLjung || hasVolClustering) {
      return "Autocorrelation tests flag potential volatility clustering at low lags.";
    }
    if (hasReturnAutocorr) {
      return "Returns show modest autocorrelation at short horizons.";
    }
    return "No strong evidence of serial dependence in the selected range.";
  }, [acfReturns, acfAbsReturns, ljungBoxResults]);

  const screenerRows = useMemo(() => {
    if (screenerState.status !== "success") {
      return [];
    }
    const rows = [...screenerState.data.metrics];
    const dirFactor = screenerSort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const aValue = a[screenerSort.key];
      const bValue = b[screenerSort.key];
      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue) * dirFactor;
      }
      const normalizeNumeric = (value: unknown): number =>
        typeof value === "number" && Number.isFinite(value)
          ? value
          : screenerSort.dir === "asc"
          ? Number.POSITIVE_INFINITY
          : Number.NEGATIVE_INFINITY;
      const aNum = normalizeNumeric(aValue);
      const bNum = normalizeNumeric(bValue);
      if (aNum === bNum) {
        return 0;
      }
      return aNum > bNum ? dirFactor : -dirFactor;
    });
    return rows.slice(0, Math.min(screenerTopN, rows.length));
  }, [screenerState, screenerSort, screenerTopN]);

  // Detect gap and volume spike events on the filtered series
  const events = useMemo(() => {
    if (rangeSeries.length === 0) {
      return { gaps: [], volumeSpikes: [] };
    }

    return {
      gaps: detectGaps(rangeSeries, gapThreshold),
      volumeSpikes: detectVolumeSpikes(rangeSeries, volumeZThreshold),
    };
  }, [rangeSeries, gapThreshold, volumeZThreshold]);

  const maSeries = useMemo(() => {
    if (priceSeries.length === 0 || insufficientMaData) {
      return [];
    }

    return computeDualMovingAverages(priceSeries, shortWindow, longWindow);
  }, [priceSeries, shortWindow, longWindow, insufficientMaData]);

  const maCrossovers = useMemo(
    () => detectMovingAverageCrossovers(maSeries),
    [maSeries],
  );
  const crossoverCounts = useMemo(() => {
    let golden = 0;
    let death = 0;
    for (const event of maCrossovers) {
      if (event.type === "golden") {
        golden += 1;
      } else {
        death += 1;
      }
    }
    return { golden, death };
  }, [maCrossovers]);

  const rsiData = useMemo(() => {
    if (priceSeries.length === 0) {
      return [];
    }

    return computeRsi(priceSeries, rsiPeriod);
  }, [priceSeries, rsiPeriod]);

  const macdData = useMemo(() => {
    if (priceSeries.length === 0) {
      return [];
    }

    return computeMacd(priceSeries, macdFast, macdSlow, macdSignal);
  }, [priceSeries, macdFast, macdSlow, macdSignal]);

  const dayOfWeekSeasonality = useMemo<CalendarBucketStats[]>(() => {
    if (returnDistribution.dailyReturns.length === 0) {
      return [];
    }
    return computeDayOfWeekSeasonality(returnDistribution.dailyReturns);
  }, [returnDistribution.dailyReturns]);

  const monthOfYearSeasonality = useMemo<CalendarBucketStats[]>(() => {
    if (returnDistribution.dailyReturns.length === 0) {
      return [];
    }
    return computeMonthOfYearSeasonality(returnDistribution.dailyReturns);
  }, [returnDistribution.dailyReturns]);

  const regimeData = useMemo(() => {
    if (priceSeries.length === 0) {
      return [];
    }

    return classifyRegimes({
      closeSeries: priceSeries,
      maShortSeries: maSeries.map((point) => ({
        date: point.date,
        ma: point.maShort,
      })),
      maLongSeries: maSeries.map((point) => ({
        date: point.date,
        ma: point.maLong,
      })),
      rsiSeries: rsiData,
      rollingVolSeries: advancedAnalytics.rollingVol21.map((point) => ({
        date: point.date,
        vol: point.vol,
      })),
      volThresholdHigh,
    });
  }, [priceSeries, maSeries, rsiData, advancedAnalytics.rollingVol21, volThresholdHigh]);

  const maSignalBacktest = useMemo(() => {
    if (priceSeries.length === 0 || maSeries.length === 0) {
      return null;
    }
    const signals = generateMaCrossoverSignals(maSeries);
    return backtestSignals(priceSeries, signals);
  }, [priceSeries, maSeries]);

  const rsiSignalBacktest = useMemo(() => {
    if (priceSeries.length === 0 || rsiData.length === 0) {
      return null;
    }
    const signals = generateRsiBandSignals(rsiData, 30, 70);
    return backtestSignals(priceSeries, signals);
  }, [priceSeries, rsiData]);

  const regimeSignalBacktest = useMemo(() => {
    if (priceSeries.length === 0 || regimeData.length === 0) {
      return null;
    }
    const signals = generateRegimeFilterSignals(regimeData);
    return backtestSignals(priceSeries, signals);
  }, [priceSeries, regimeData]);

  const forecastPoints = useMemo(() => {
    if (priceSeries.length === 0) {
      return [];
    }
    return forecastPrices(priceSeries, forecastHorizon, forecastModel);
  }, [priceSeries, forecastHorizon, forecastModel]);

  const stockVarEs = useMemo(
    () => computeVarEs(returnDistribution.dailyReturns, tailHorizon, tailConfidence),
    [returnDistribution.dailyReturns, tailHorizon, tailConfidence],
  );

  const pcaResult = screenerState.status === "success" ? screenerState.data.pca : null;

  const maBacktest = useMemo(() => {
    if (priceSeries.length === 0 || insufficientMaData) {
      return EMPTY_BACKTEST_RESULT;
    }

    return backtestMaCrossoverStrategy(priceSeries, maCrossovers);
  }, [priceSeries, maCrossovers, insufficientMaData]);

  const buyAndHoldBacktest = useMemo(() => {
    if (priceSeries.length === 0) {
      return EMPTY_BACKTEST_RESULT;
    }

    return backtestBuyAndHold(priceSeries);
  }, [priceSeries]);

  const strategyComparisonRows = useMemo(() => {
    const rows: {
      name: string;
      totalReturn: number | null;
      maxDrawdown: number | null;
      cagr: number | null;
      hitRate: number | null;
    }[] = [];

    const buildFromBacktestResult = (name: string, result: BacktestResult) => {
      rows.push({
        name,
        totalReturn: result.totalReturn,
        maxDrawdown: result.maxDrawdown,
        cagr: result.cagr,
        hitRate:
          result.trades.length > 0
            ? result.trades.filter(
                (trade) => trade.return !== null && trade.return > 0,
              ).length / result.trades.length
            : null,
      });
    };

    const buildFromGeneric = (
      name: string,
      result: ReturnType<typeof backtestSignals> | null,
    ) => {
      if (!result) {
        return;
      }
      rows.push({
        name,
        totalReturn: result.totalReturn,
        maxDrawdown: result.maxDrawdown,
        cagr: result.cagr,
        hitRate: result.hitRate,
      });
    };

    buildFromBacktestResult("Buy & hold", buyAndHoldBacktest);
    buildFromGeneric("MA crossover (signals)", maSignalBacktest);
    buildFromGeneric("RSI bands (30/70)", rsiSignalBacktest);
    buildFromGeneric("Regime filter (uptrend only)", regimeSignalBacktest);

    return rows;
  }, [
    buyAndHoldBacktest,
    maSignalBacktest,
    rsiSignalBacktest,
    regimeSignalBacktest,
  ]);

  const recentCrossovers = useMemo(() => {
    const sorted = [...maCrossovers].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
    return sorted.slice(0, 10);
  }, [maCrossovers]);

  const analyticsSnapshot = useMemo<StockAnalyticsSnapshot | null>(() => {
    if (rangeSeries.length === 0) {
      return null;
    }

    return buildAnalyticsSnapshot({
      symbol,
      range,
      stats,
      rangeSeries,
      rollingVol21: advancedAnalytics.rollingVol21,
      rollingVol63: advancedAnalytics.rollingVol63,
      rollingRet21: advancedAnalytics.rollingRet21,
      drawdownSeries: advancedAnalytics.drawdown,
      sharpeRatio: returnDistribution.sharpeRatio,
      higherMoments: returnDistribution.moments,
      histogram: returnDistribution.histogram,
    });
  }, [
    symbol,
    range,
    stats,
    rangeSeries,
    advancedAnalytics,
    returnDistribution.histogram,
    returnDistribution.moments,
    returnDistribution.sharpeRatio,
  ]);

  const capmStats = useMemo(() => {
    if (
      singleState.status !== "success" ||
      benchmarkState.status !== "success"
    ) {
      return EMPTY_CAPM_STATS;
    }

    const assetSeries = filterByRange(singleState.data.series, range).map(
      (point) => ({
        date: point.date,
        close: point.close,
      }),
    );

    const benchmarkSeries = filterByRange(benchmarkState.data.series, range).map(
      (point) => ({
        date: point.date,
        close: point.close,
      }),
    );

    if (assetSeries.length < 2 || benchmarkSeries.length < 2) {
      return EMPTY_CAPM_STATS;
    }

    return computeCapmStats(assetSeries, benchmarkSeries);
  }, [singleState, benchmarkState, range]);

  // NOTE: returnDistribution defined above

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

  const portfolioData = useMemo(() => {
    if (multiState.status !== "success" || multiSymbols.length < 2) {
      return {
        series: [] as PortfolioPoint[],
        metrics: {
          returns: [],
          sharpe: null,
          volatility: null,
          maxDrawdown: null,
          totalReturn: null,
        },
      };
    }

    const seriesBySymbol: Record<string, { date: string; close: number }[]> = {};
    for (const sym of multiSymbols) {
      const stock = multiState.data[sym];
      if (!stock) continue;
      const filtered = filterByRange(stock.series, range).map((point) => ({
        date: point.date,
        close: point.close,
      }));
      seriesBySymbol[sym] = filtered;
    }

    const series = computePortfolioSeries(seriesBySymbol);
    const metrics = computePortfolioMetrics(series);
    return { series, metrics };
  }, [multiState, multiSymbols, range]);

  const portfolioLogReturns = useMemo(() => {
    if (portfolioData.series.length < 2) {
      return [];
    }
    const returns: DatedReturn[] = [];
    for (let i = 1; i < portfolioData.series.length; i++) {
      const prev = portfolioData.series[i - 1].close;
      const curr = portfolioData.series[i].close;
      if (prev > 0 && curr > 0) {
        returns.push({
          date: portfolioData.series[i].date,
          r: Math.log(curr / prev),
        });
      }
    }
    return returns;
  }, [portfolioData.series]);

  const portfolioVarEs = useMemo(
    () => computeVarEs(portfolioLogReturns, tailHorizon, tailConfidence),
    [portfolioLogReturns, tailHorizon, tailConfidence],
  );

  const optimisationInput = useMemo<OptimisationInputs | null>(() => {
    if (multiState.status !== "success" || multiSymbols.length < 2) {
      return null;
    }

    const returnsBySymbol: Record<string, DatedReturn[]> = {};
    const usableSymbols: string[] = [];

    for (const sym of multiSymbols) {
      const stock = multiState.data[sym];
      if (!stock) continue;
      const filteredSeries = filterByRange(stock.series, range);
      if (filteredSeries.length < 2) continue;
      const returns = getDailyLogReturns(filteredSeries);
      if (returns.length === 0) continue;
      returnsBySymbol[sym] = returns;
      usableSymbols.push(sym);
    }

    return usableSymbols.length >= 2
      ? { symbols: usableSymbols, returnsBySymbol }
      : null;
  }, [multiState, multiSymbols, range]);

  const optimisationResults = useMemo<{
    frontier: FrontierPoint[];
    minVar: FrontierPoint | null;
    maxSharpe: FrontierPoint | null;
  }>(() => {
    if (!optimisationInput) {
      return { frontier: [], minVar: null, maxSharpe: null };
    }
    const frontier = computeEfficientFrontier(
      optimisationInput,
      DEFAULT_OPTIMISATION_POINTS,
      { riskFreeRateAnnual: DEFAULT_RISK_FREE_RATE_ANNUAL },
    );
    return {
      frontier,
      minVar: findMinVariancePortfolio(frontier),
      maxSharpe: findMaxSharpePortfolio(
        frontier,
        DEFAULT_RISK_FREE_RATE_ANNUAL,
      ),
    };
  }, [optimisationInput]);

  const optimisationSymbols = optimisationInput?.symbols ?? [];
  const minVarSharpe = useMemo(
    () => computePointSharpe(optimisationResults.minVar, DEFAULT_RISK_FREE_RATE_ANNUAL),
    [optimisationResults.minVar],
  );
  const maxSharpeRatio = useMemo(
    () => computePointSharpe(optimisationResults.maxSharpe, DEFAULT_RISK_FREE_RATE_ANNUAL),
    [optimisationResults.maxSharpe],
  );
  const optimisationUniverseSize =
    optimisationSymbols.length > 0 ? optimisationSymbols.length : multiSymbols.length;

  // Compute correlation matrix from multi-stock data
  const correlationMatrix = useMemo((): CorrelationMatrix | null => {
    if (multiState.status !== "success") {
      return null;
    }

    // Prepare data for correlation calculation
    const seriesBySymbol: Record<string, { date: string; close: number }[]> = {};

    // Add all selected symbols
    for (const sym of multiSymbols) {
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

  // Compute rolling correlations when multiple symbols are selected
  const rollingCorrelations = useMemo(() => {
    if (multiState.status !== "success" || multiSymbols.length < 2) {
      return [];
    }

    // Use first symbol as reference
    const referenceSymbol = multiSymbols[0];
    const referenceSeries = multiState.data[referenceSymbol]?.series;
    if (!referenceSeries) return [];

    // Convert to CorrelationInput format and filter by range
    const referenceData = filterByRange(referenceSeries, range).map((point) => ({
      date: point.date,
      close: point.close,
    }));

    // Compute rolling correlation for each other symbol vs reference
    const correlations: Array<{
      symbol: string;
      data: RollingCorrelationPoint[];
    }> = [];

    for (let i = 1; i < multiSymbols.length; i++) {
      const symbol = multiSymbols[i];
      const series = multiState.data[symbol]?.series;
      if (!series) continue;

      const symbolData = filterByRange(series, range).map((point) => ({
        date: point.date,
        close: point.close,
      }));

      const corrData = computeRollingCorrelation(referenceData, symbolData, correlationWindow);
      if (corrData.length > 0) {
        correlations.push({ symbol, data: corrData });
      }
    }

    return correlations;
  }, [multiState, multiSymbols, range, correlationWindow]);

  // ───────────────────────────────────────────────────────────────────────────
  // Derived State Flags
  // ───────────────────────────────────────────────────────────────────────────

  const isSingleLoading = singleState.status === "loading";
  const isSingleError = singleState.status === "error";
  const isMultiLoading = multiState.status === "loading";
  const isMultiError = multiState.status === "error";
  const isBenchmarkLoading = benchmarkState.status === "loading";
  const isBenchmarkError = benchmarkState.status === "error";
  const assetDisplayName = getSymbolDisplayName(symbol);
  const benchmarkDisplayName = getSymbolDisplayName(DEFAULT_BENCHMARK_SYMBOL);

  const buildFilename = (extension: string): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${symbol}_${range}_${timestamp}.${extension}`;
  };

  const triggerDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJsonSnapshot = (): void => {
    if (!analyticsSnapshot) {
      return;
    }

    const filename = buildFilename("analytics.json");
    const blob = new Blob([JSON.stringify(analyticsSnapshot, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, filename);
  };

  const handleDownloadCsv = (): void => {
    if (rangeSeries.length === 0) {
      return;
    }

    const csvContent = buildCsvContent({
      rangeSeries,
      dailyReturns: returnDistribution.dailyReturns,
      rollingVol21: advancedAnalytics.rollingVol21,
      rollingVol63: advancedAnalytics.rollingVol63,
      rollingRet21: advancedAnalytics.rollingRet21,
      drawdown: advancedAnalytics.drawdown,
    });

    const filename = buildFilename("analytics.csv");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    triggerDownload(blob, filename);
  };

  const handleShortWindowChange = (value: number): void => {
    setShortWindow((currentShort) => {
      const sanitized = sanitizeShortWindow(value, longWindow);
      return sanitized !== currentShort ? sanitized : currentShort;
    });
  };

  const handleLongWindowChange = (value: number): void => {
    setLongWindow((currentLong) => {
      const sanitized = sanitizeLongWindow(value, shortWindow);
      return sanitized !== currentLong ? sanitized : currentLong;
    });
  };

  const handleLoadScreener = useCallback(async () => {
    setScreenerState({ status: "loading" });
    try {
      const responses = await Promise.all(
        NASDAQ_STOCKS.map(async ({ symbol }) => {
          const response = await fetch(`/api/stocks/${symbol}`);
          if (!response.ok) {
            const errorMessage = await extractErrorMessage(response);
            throw new Error(errorMessage);
          }
          const data = (await response.json()) as StockApiResponse;
          const simplified = data.series.map((point) => ({
            date: point.date,
            close: point.close,
          }));
          return [symbol, simplified] as const;
        }),
      );

      const seriesBySymbol: SymbolSeriesMap = {};
      for (const [symbol, simplified] of responses) {
        seriesBySymbol[symbol] = simplified;
      }

      const metrics = computeCrossSectionMetrics(seriesBySymbol);
      const pca = computeReturnPca(seriesBySymbol);
      setScreenerState({
        status: "success",
        data: { metrics, pca },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load screener data. Please try again.";
      setScreenerState({ status: "error", error: message });
    }
  }, []);

  const handleScreenerSortChange = useCallback(
    (key: keyof CrossSectionMetrics) => {
      setScreenerSort((prev) => {
        if (prev.key === key) {
          return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
        }
        return { key, dir: key === "symbol" ? "asc" : "desc" };
      });
    },
    [],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  const timeRangeOptions: TimeRange[] = ["5D", "10D", "1M", "3M", "6M", "1Y", "MAX"];
  const gapThresholdOptions = [0.02, 0.03, 0.05, 0.08];
  const volumeThresholdOptions = [1.5, 2, 2.5, 3];
  const screenerTopNOptions = [5, 10, 15, NASDAQ_STOCKS.length];
  const forecastHorizonOptions = [5, 10, 20];
  const tailHorizonOptions = [1, 5, 10];
  const tailConfidenceOptions = [0.9, 0.95, 0.99];

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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadJsonSnapshot}
              disabled={!analyticsSnapshot}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-100 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download JSON snapshot
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={rangeSeries.length === 0}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-100 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download CSV (daily metrics)
            </button>
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
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-medium text-neutral-200">
                  {singleState.status === "success"
                    ? `${singleState.data.symbol} — Price History`
                    : "Price History"}
                </h2>
                <GlossaryTooltip entryId="price-chart" />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Markers highlight gap opens and abnormal volume within the selected range.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rotate-45 bg-orange-400" aria-hidden="true" />
                  <span className="text-xs font-medium text-neutral-300">
                    Gap &ge;
                  </span>
                </div>
                <select
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-none ring-0 focus:border-neutral-500"
                  value={gapThreshold}
                  onChange={(e) => setGapThreshold(Number(e.target.value))}
                >
                  {gapThresholdOptions.map((value) => (
                    <option key={value} value={value}>
                      {`${formatAxisNumber(value * 100)}%`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400" aria-hidden="true" />
                  <span className="text-xs font-medium text-neutral-300">
                    Volume z
                  </span>
                </div>
                <select
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 outline-none ring-0 focus:border-neutral-500"
                  value={volumeZThreshold}
                  onChange={(e) => setVolumeZThreshold(Number(e.target.value))}
                >
                  {volumeThresholdOptions.map((value) => (
                    <option key={value} value={value}>
                      {formatAxisNumber(value)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="hidden items-center gap-2 text-[11px] text-neutral-500 sm:flex">
                <span>
                  {events.gaps.length} gaps · {events.volumeSpikes.length} volume spikes
                </span>
                <GlossaryTooltip entryId="event-detection" />
              </div>
            </div>
          </div>
          {singleChartData.length > 0 ? (
            <StockChart
              data={singleChartData}
              symbol={symbol}
              gapEvents={events.gaps}
              volumeEvents={events.volumeSpikes}
            />
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
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-medium text-neutral-200">
              Risk &amp; Return
            </h2>
            <GlossaryTooltip entryId="risk-cards" />
          </div>
          {stats ? (
            <StatsCards stats={stats} symbol={symbol} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
              Not enough data to compute statistics.
            </div>
          )}
        </section>
      </div>

      {/* Trend signals section */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-neutral-200">
              Trend signals (Moving Averages)
            </h2>
            <GlossaryTooltip entryId="trend-signals" />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Golden cross = short MA crossing above long MA (bullish). Death cross = short MA crossing below long MA (bearish).
          </p>
        </div>
        <div className="mb-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            Short window
            <input
              type="number"
              min={MIN_MA_WINDOW}
              max={longWindow - 1}
              value={shortWindow}
              onChange={(event) =>
                handleShortWindowChange(Number(event.target.value))
              }
              className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            Long window
            <input
              type="number"
              min={shortWindow + 1}
              max={MAX_MA_WINDOW}
              value={longWindow}
              onChange={(event) =>
                handleLongWindowChange(Number(event.target.value))
              }
              className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
            />
          </label>
        </div>
        <p className="text-[11px] text-neutral-500">
          Short MA must be at least 2 days and less than the long MA. Long MA
          can be up to {MAX_MA_WINDOW} days.
        </p>
        {priceSeries.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
            Select a date range with data to view moving averages.
          </div>
        ) : insufficientMaData ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
            Not enough data for the selected MA windows in this range. Try
            choosing a shorter window combination or expanding the date range.
          </div>
        ) : maSeries.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
            Unable to compute moving averages for this configuration. Please adjust the inputs.
          </div>
        ) : (
          <>
            <MaTrendChart
              data={maSeries}
              shortWindow={shortWindow}
              longWindow={longWindow}
              crossovers={maCrossovers}
            />
            <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-xs text-neutral-300 sm:text-sm">
              Detected{" "}
              <span className="font-semibold text-emerald-400">
                {crossoverCounts.golden}
              </span>{" "}
              golden {crossoverCounts.golden === 1 ? "cross" : "crosses"} and{" "}
              <span className="font-semibold text-red-400">
                {crossoverCounts.death}
              </span>{" "}
              death {crossoverCounts.death === 1 ? "cross" : "crosses"} in the selected range.
            </div>
            {maCrossovers.length === 0 ? (
              <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
                No golden or death crosses detected within the selected range.
              </div>
            ) : (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-neutral-200">
                  Recent crossover events
                </h3>
                <table className="mt-2 w-full table-auto border-collapse text-xs text-neutral-300">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="border-b border-neutral-800 px-2 py-2 font-medium">
                        Date
                      </th>
                      <th className="border-b border-neutral-800 px-2 py-2 font-medium">
                        Type
                      </th>
                      <th className="border-b border-neutral-800 px-2 py-2 font-medium">
                        Short (d)
                      </th>
                      <th className="border-b border-neutral-800 px-2 py-2 font-medium">
                        Long (d)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCrossovers.map((event) => (
                      <tr key={event.date}>
                        <td className="border-b border-neutral-900 px-2 py-2 text-neutral-200">
                          {event.date}
                        </td>
                        <td className="border-b border-neutral-900 px-2 py-2 font-semibold">
                          {event.type === "golden" ? (
                            <span className="text-emerald-400">Golden</span>
                          ) : (
                            <span className="text-red-400">Death</span>
                          )}
                        </td>
                        <td className="border-b border-neutral-900 px-2 py-2">
                          {shortWindow}
                        </td>
                        <td className="border-b border-neutral-900 px-2 py-2">
                          {longWindow}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-medium text-neutral-200">
                MA Crossover Backtest
              </h3>
              {maBacktest.trades.length === 0 ? (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
                  No trades generated by this MA configuration in the selected range.
                </div>
              ) : (
                <>
                  <BacktestSummary
                    result={maBacktest}
                    symbol={symbol}
                    shortWindow={shortWindow}
                    longWindow={longWindow}
                  />
                  <EquityCurveChart result={maBacktest} />
                </>
              )}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-4">
          <h2 className="text-base font-medium text-neutral-200">
            Strategy comparison (current symbol &amp; range)
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Quick view of buy &amp; hold vs. simple signal-based strategies. Statistics are based on the currently selected date range.
          </p>
        </div>
        {strategyComparisonRows.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400">
            Not enough data to run the strategy comparison for this selection.
          </div>
        ) : (
          <StrategyComparisonTable rows={strategyComparisonRows} />
        )}
      </section>

      {/* Regime Classification */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Regime Classification
              </h2>
              <GlossaryTooltip entryId="regime-classification" />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Combines moving averages, RSI, and volatility to highlight daily market regimes.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            Volatility threshold
            <input
              type="number"
              min={0.05}
              step={0.05}
              value={volThresholdHigh}
              onChange={(event) =>
                setVolThresholdHigh(
                  Math.max(0.05, Number(event.target.value) || 0.35),
                )
              }
              className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
            />
            <span className="text-[11px] text-neutral-500">
              Annualized vol
            </span>
          </label>
        </div>

        {regimeData.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
            Not enough aligned data to classify regimes.
          </div>
        ) : (
          <>
            <RegimeTimeline regimes={regimeData} />
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-neutral-400 sm:grid-cols-4">
              {(["uptrend", "downtrend", "sideways", "high-volatility"] as const).map(
                (regime) => {
                  const count = regimeData.filter((point) => point.regime === regime).length;
                  const pct = count / regimeData.length;
                  return (
                    <div key={regime} className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                        {regime.replace("-", " ")}
                      </div>
                      <div className="mt-1 text-base font-semibold text-neutral-100">
                        {formatAxisNumber(pct * 100)}%
                        <span className="ml-1 text-[11px] text-neutral-500">
                          ({count} days)
                        </span>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </>
        )}
      </section>

      {/* Momentum & Oscillators */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Momentum &amp; Oscillators
              </h2>
              <GlossaryTooltip entryId="momentum" />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              RSI highlights overbought (&gt;70) / oversold (&lt;30). MACD shows momentum shifts (MACD vs signal).
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-neutral-400">
            <label className="flex items-center gap-1">
              RSI period
              <input
                type="number"
                min={2}
                max={100}
                value={rsiPeriod}
                onChange={(event) => setRsiPeriod(Number(event.target.value) || DEFAULT_RSI_PERIOD)}
                className="w-16 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex items-center gap-1">
              MACD fast
              <input
                type="number"
                min={2}
                value={macdFast}
                onChange={(event) => setMacdFast(Number(event.target.value) || DEFAULT_MACD_FAST)}
                className="w-16 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex items-center gap-1">
              MACD slow
              <input
                type="number"
                min={macdFast + 1}
                value={macdSlow}
                onChange={(event) =>
                  setMacdSlow(
                    Math.max(Number(event.target.value) || DEFAULT_MACD_SLOW, macdFast + 1),
                  )
                }
                className="w-16 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex items-center gap-1">
              MACD signal
              <input
                type="number"
                min={2}
                value={macdSignal}
                onChange={(event) => setMacdSignal(Number(event.target.value) || DEFAULT_MACD_SIGNAL)}
                className="w-16 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              />
            </label>
          </div>
        </div>

        {rangeSeries.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
            Select a range with data to compute RSI/MACD.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <RsiChart data={rsiData} period={rsiPeriod} />
              <MacdChart
                data={macdData}
                fastPeriod={macdFast}
                slowPeriod={macdSlow}
                signalPeriod={macdSignal}
              />
            </div>
            <div className="mt-3 text-xs text-neutral-400">
              Latest RSI:{" "}
              {rsiData.length > 0 && rsiData[rsiData.length - 1].rsi !== null
                ? formatAxisNumber(rsiData[rsiData.length - 1].rsi!)
                : "—"}
              . MACD is{" "}
              {(() => {
                const latest = macdData[macdData.length - 1];
                if (!latest || latest.macd === null || latest.signal === null) {
                  return "undefined relative to signal.";
                }
                return latest.macd > latest.signal ? "above signal (bullish)." : "below signal (bearish).";
              })()}
            </div>
          </>
        )}
      </section>

      {/* Benchmark analytics / CAPM */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Benchmark Analytics
              </h2>
              <GlossaryTooltip entryId="capm" />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              CAPM regression vs {benchmarkDisplayName} ({DEFAULT_BENCHMARK_SYMBOL}).
            </p>
          </div>
          <span className="text-xs text-neutral-500">
            Using {range === "MAX" ? "full history" : range} window
          </span>
        </div>
        {isBenchmarkLoading || isSingleLoading ? (
          <div className="flex h-28 items-center justify-center text-sm text-neutral-500">
            Loading benchmark analytics…
          </div>
        ) : isBenchmarkError ? (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
            <p className="font-semibold">Unable to load benchmark data</p>
            <p className="mt-1 text-xs text-red-300">{benchmarkState.error}</p>
          </div>
        ) : singleState.status !== "success" ||
          benchmarkState.status !== "success" ? (
          <div className="flex h-28 items-center justify-center text-sm text-neutral-500">
            Select a symbol to see CAPM analytics.
          </div>
        ) : (
          <CapmPanel
            stats={capmStats}
            assetName={assetDisplayName}
            benchmarkName={benchmarkDisplayName}
          />
        )}
      </section>

      {/* Return Distribution & Risk Profile */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Histogram - takes 3/5 on large screens */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 lg:col-span-3">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Return Distribution
              </h2>
              <GlossaryTooltip entryId="return-distribution" />
            </div>
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
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Risk Profile
              </h2>
              <GlossaryTooltip entryId="risk-profile" />
            </div>
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

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Risk tails (VaR &amp; ES)
              </h2>
              <GlossaryTooltip entryId="risk-tail" />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Value-at-Risk and Expected Shortfall estimates for the selected stock and the equal-weight portfolio.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
            <label className="flex items-center gap-1">
              Horizon
              <select
                value={tailHorizon}
                onChange={(event) => setTailHorizon(Number(event.target.value))}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              >
                {tailHorizonOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}d
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              Confidence
              <select
                value={tailConfidence}
                onChange={(event) => setTailConfidence(Number(event.target.value))}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              >
                {tailConfidenceOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatPercent(option)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <VarEsPanel label="Selected stock" result={stockVarEs} />
          <VarEsPanel label="Equal-weight portfolio" result={portfolioVarEs} />
        </div>
      </section>

      {/* Serial dependence & volatility clustering */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-neutral-200">
              Serial Dependence &amp; Volatility Clustering
            </h2>
            <GlossaryTooltip entryId="serial-dependence" />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Autocorrelation diagnostics on daily log returns (lags up to 20).
          </p>
        </div>
        {isSingleLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
            Computing autocorrelation…
          </div>
        ) : dailyReturnCount < 5 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
            Not enough data in the selected range to analyse autocorrelation.
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
                <AcfChart
                  acf={acfReturns}
                  title="ACF (returns)"
                  sampleSize={dailyReturnCount}
                />
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
                <AcfChart
                  acf={acfAbsReturns}
                  title="ACF (|returns|)"
                  sampleSize={dailyReturnCount}
                />
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Ljung–Box test
                </p>
                <LjungBoxTable results={ljungBoxResults} />
              </div>
            </div>
            <p className="mt-4 text-xs text-neutral-400">
              {serialDependenceSummary}
            </p>
          </>
        )}
      </section>

      {/* Seasonality & calendar effects */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-neutral-200">
              Seasonality &amp; Calendar Effects
            </h2>
            <GlossaryTooltip entryId="seasonality" />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Average daily log returns by day of week and month (selected range).
          </p>
        </div>
        {isSingleLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
            Analysing seasonality…
          </div>
        ) : dayOfWeekSeasonality.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
            Not enough daily observations to compute seasonality.
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <SeasonalityBars
                title="Day-of-week returns"
                buckets={dayOfWeekSeasonality}
              />
              <SeasonalityBars
                title="Month-of-year returns"
                buckets={monthOfYearSeasonality}
              />
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              Mean daily log returns are plotted in %; standard deviation and observation
              counts are shown in the tooltip. Patterns may be noisy when sample sizes are small.
            </p>
          </>
        )}
      </section>

      {/* Screener & Ranking */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Screener &amp; Ranking
              </h2>
              <GlossaryTooltip entryId="screener" />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Rank our NASDAQ universe ({NASDAQ_STOCKS.length} tickers) by momentum, volatility, and Sharpe.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {screenerState.status === "success" && (
              <label className="flex items-center gap-2 text-xs text-neutral-400">
                Show top
                <select
                  value={screenerTopN}
                  onChange={(event) => setScreenerTopN(Number(event.target.value))}
                  className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
                >
                  {screenerTopNOptions.map((option) => (
                    <option key={option} value={option}>
                      {option >= NASDAQ_STOCKS.length ? "All" : option}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={handleLoadScreener}
              disabled={screenerState.status === "loading"}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-100 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {screenerState.status === "loading" ? "Loading…" : "Load Screener"}
            </button>
          </div>
        </div>
        {screenerState.status === "idle" && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-400">
            Load the screener to pull the latest metrics for every symbol in the watchlist.
          </div>
        )}
        {screenerState.status === "loading" && (
          <div className="flex h-32 items-center justify-center text-sm text-neutral-500">
            Fetching data for {NASDAQ_STOCKS.length} tickers…
          </div>
        )}
        {screenerState.status === "error" && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-200">
            {screenerState.error}
          </div>
        )}
        {screenerState.status === "success" && (
          <>
            <CrossSectionTable
              rows={screenerRows}
              sortBy={screenerSort.key}
              sortDir={screenerSort.dir}
              onSortChange={handleScreenerSortChange}
            />
            <p className="mt-3 text-xs text-neutral-500">
              Returns are simple daily returns over ~21/63 trading days. Volatility is annualised from daily log returns; Sharpe assumes a 0% risk-free rate.
            </p>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Risk model (PCA)
              </h2>
              <GlossaryTooltip entryId="risk-model" />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Principal-component view of cross-sectional returns for the NASDAQ universe.
            </p>
          </div>
        </div>
        {screenerState.status !== "success" ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400">
            Load the screener to compute the PCA-based risk model.
          </div>
        ) : !pcaResult ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-400">
            Not enough overlapping history to compute PCA on the selected universe.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
              <PcaExplainedVarianceChart result={pcaResult} />
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
              <PcaLoadingsTable result={pcaResult} />
            </div>
          </div>
        )}
      </section>

      {/* Forecast section */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Price Forecast (baseline models)
              </h2>
              <GlossaryTooltip entryId="forecast" />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Simple projections based on naive, rolling mean, or EWMA assumptions. Not investment advice.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
            <label className="flex items-center gap-1">
              Model
              <select
                value={forecastModel}
                onChange={(event) => setForecastModel(event.target.value as ForecastModelType)}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              >
                <option value="naive">Naive</option>
                <option value="rolling_mean">Rolling mean</option>
                <option value="ewma">EWMA</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              Horizon
              <select
                value={forecastHorizon}
                onChange={(event) => setForecastHorizon(Number(event.target.value))}
                className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              >
                {forecastHorizonOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}d
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <ForecastChart history={priceSeries} forecast={forecastPoints} />
      </section>

      {/* Advanced Time-Series Analytics - Collapsible Section */}
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50">
        <button
          type="button"
          onClick={() => setAnalyticsOpen(!analyticsOpen)}
          className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-neutral-800/30"
        >
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Advanced Time-Series Analytics
              </h2>
              <GlossaryTooltip entryId="advanced-analytics" />
            </div>
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
              <div className="flex items-center gap-2">
                <h2 className="text-base font-medium text-neutral-200">
                  Multi-Stock Comparison
                </h2>
                <GlossaryTooltip entryId="multi-comparison" />
              </div>
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
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-neutral-200">
                Correlation Matrix
              </h2>
              <GlossaryTooltip entryId="correlation-matrix" />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Daily log-return correlations between selected symbols.
            </p>
          </div>

          {isMultiLoading && (
            <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
              Loading correlation data…
            </div>
          )}

          {!isMultiLoading && multiSymbols.length < 2 && (
            <div className="flex h-48 items-center justify-center text-center text-sm text-neutral-500">
              Select at least 2 tickers to see
              <br />
              their correlation matrix.
            </div>
          )}

          {!isMultiLoading && correlationMatrix && (
            <CorrelationHeatmap matrix={correlationMatrix} />
          )}
        </section>
      </div>

      {/* Portfolio view */}
      {portfolioData.series.length > 0 && (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-medium text-neutral-200">
                  Portfolio (equal-weight)
                </h2>
                <GlossaryTooltip entryId="equal-weight-portfolio" />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Normalized to 1 on the first common date of {multiSymbols.join(", ")}.
              </p>
            </div>
            <div className="text-xs text-neutral-500">
              {multiSymbols.length} tickers
            </div>
          </div>
          <PortfolioStatsPanel
            volatility={portfolioData.metrics.volatility}
            sharpe={portfolioData.metrics.sharpe}
            maxDrawdown={portfolioData.metrics.maxDrawdown}
            totalReturn={portfolioData.metrics.totalReturn}
          />
          <div className="mt-4">
            <PortfolioChart data={portfolioData.series} />
          </div>
        </section>
      )}

      {multiSymbols.length >= 2 && (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="mb-4">
            <h2 className="text-base font-medium text-neutral-200">
              Portfolio optimisation (mean-variance)
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Long-only grid search across up to {optimisationUniverseSize} symbols. Risk-free
              rate assumed at {formatPercentOrDash(DEFAULT_RISK_FREE_RATE_ANNUAL)} for Sharpe
              calculations.
            </p>
          </div>
          {isMultiLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
              Crunching optimisation grid
            </div>
          ) : optimisationResults.frontier.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5 text-sm text-neutral-400">
              Need overlapping daily return history for at least two of the selected tickers.
            </div>
          ) : (
            <>
              <EfficientFrontierChart
                frontier={optimisationResults.frontier}
                minVar={optimisationResults.minVar}
                maxSharpe={optimisationResults.maxSharpe}
              />
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-neutral-100">
                        Min-variance portfolio
                      </div>
                      <p className="text-xs text-neutral-500">
                        Lowest annualised volatility on the frontier.
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-neutral-300">
                    <div>
                      <dt className="text-neutral-500">Expected return</dt>
                      <dd className="font-semibold text-neutral-100">
                        {formatPercentOrDash(optimisationResults.minVar?.expectedReturn)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Volatility</dt>
                      <dd className="font-semibold text-neutral-100">
                        {formatPercentOrDash(optimisationResults.minVar?.volatility)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Sharpe</dt>
                      <dd className="font-semibold text-neutral-100">
                        {formatNumberOrDash(minVarSharpe)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <PortfolioWeightsTable
                      point={optimisationResults.minVar}
                      symbols={optimisationSymbols}
                      title="Weights"
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-neutral-100">
                        Max-Sharpe portfolio
                      </div>
                      <p className="text-xs text-neutral-500">
                        Highest excess return per unit of risk vs. {formatPercentOrDash(DEFAULT_RISK_FREE_RATE_ANNUAL)}.
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-neutral-300">
                    <div>
                      <dt className="text-neutral-500">Expected return</dt>
                      <dd className="font-semibold text-neutral-100">
                        {formatPercentOrDash(optimisationResults.maxSharpe?.expectedReturn)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Volatility</dt>
                      <dd className="font-semibold text-neutral-100">
                        {formatPercentOrDash(optimisationResults.maxSharpe?.volatility)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Sharpe</dt>
                      <dd className="font-semibold text-neutral-100">
                        {formatNumberOrDash(maxSharpeRatio)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <PortfolioWeightsTable
                      point={optimisationResults.maxSharpe}
                      symbols={optimisationSymbols}
                      title="Weights"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* Rolling Correlations Section - Only show when 2+ symbols selected */}
      {multiSymbols.length >= 2 && rollingCorrelations.length > 0 && (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
          <div className="mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-medium text-neutral-200">
                    Rolling Correlations (vs {multiSymbols[0]})
                  </h2>
                  <GlossaryTooltip entryId="rolling-correlations" />
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {correlationWindow}-day rolling correlation coefficients over time. Reference ticker: {multiSymbols[0]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-400">Window</span>
                <div className="flex rounded-lg border border-neutral-700 bg-neutral-900/50 p-0.5">
                  {([21, 63, 126] as const).map((window) => (
                    <button
                      key={window}
                      type="button"
                      onClick={() => setCorrelationWindow(window)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        window === correlationWindow
                          ? "bg-neutral-100 text-neutral-900 shadow-sm"
                          : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                      }`}
                      title={
                        window === 21
                          ? "1 month (21 trading days)"
                          : window === 63
                          ? "3 months (63 trading days)"
                          : "6 months (126 trading days)"
                      }
                    >
                      {window}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {isMultiLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
              Loading rolling correlation data…
            </div>
          ) : (
            <MultiRollingCorrelationChart
              series={rollingCorrelations}
              referenceSymbol={multiSymbols[0]}
              windowDays={correlationWindow}
            />
          )}
        </section>
      )}

      <GlossaryPanel />
    </div>
  );
}
const DEFAULT_OPTIMISATION_POINTS = 80;
const DEFAULT_RISK_FREE_RATE_ANNUAL = 0.02;
const DEFAULT_SHORT_WINDOW = 20;
const DEFAULT_LONG_WINDOW = 50;
const MIN_MA_WINDOW = 2;
const DEFAULT_RSI_PERIOD = 14;
const DEFAULT_MACD_FAST = 12;
const DEFAULT_MACD_SLOW = 26;
const DEFAULT_MACD_SIGNAL = 9;
