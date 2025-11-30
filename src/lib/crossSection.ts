import { computeSharpeRatio, type CrossSectionMetrics, type DatedReturn, type PricePoint } from "./stats";

export type SymbolSeriesMap = Record<string, PricePoint[]>;

const TRADING_DAYS_PER_YEAR = 252;
const ONE_MONTH_DAYS = 21;
const THREE_MONTH_DAYS = 63;
const LOOKBACK_DAYS = 63;

function isValidPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function sampleStd(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);
  return variance >= 0 ? Math.sqrt(variance) : null;
}

function calculateReturn(
  series: PricePoint[],
  lookback: number,
): number | null {
  if (series.length <= lookback) {
    return null;
  }
  const end = series[series.length - 1];
  const start = series[series.length - 1 - lookback];
  if (!isValidPrice(end.close) || !isValidPrice(start.close)) {
    return null;
  }
  return end.close / start.close - 1;
}

export function computeCrossSectionMetrics(
  seriesBySymbol: SymbolSeriesMap,
): CrossSectionMetrics[] {
  return Object.entries(seriesBySymbol).map(([symbol, series]) => {
    if (!series || series.length === 0) {
      return {
        symbol,
        lastClose: null,
        return1M: null,
        return3M: null,
        volAnnual: null,
        sharpe: null,
      };
    }

    const lookbackSeries =
      series.length > LOOKBACK_DAYS
        ? series.slice(series.length - LOOKBACK_DAYS)
        : [...series];

    const lastClose =
      lookbackSeries.length > 0
        ? lookbackSeries[lookbackSeries.length - 1].close
        : null;

    const return1M = calculateReturn(lookbackSeries, ONE_MONTH_DAYS);
    const return3M = calculateReturn(lookbackSeries, THREE_MONTH_DAYS);

    const returns: DatedReturn[] = [];
    for (let i = 1; i < lookbackSeries.length; i++) {
      const prev = lookbackSeries[i - 1];
      const curr = lookbackSeries[i];
      if (!isValidPrice(prev.close) || !isValidPrice(curr.close)) {
        continue;
      }
      const logReturn = Math.log(curr.close / prev.close);
      if (Number.isFinite(logReturn)) {
        returns.push({ date: curr.date, r: logReturn });
      }
    }

    const stdDaily = sampleStd(returns.map((item) => item.r));
    const volAnnual =
      stdDaily !== null ? stdDaily * Math.sqrt(TRADING_DAYS_PER_YEAR) : null;

    const sharpe = computeSharpeRatio(returns);

    return {
      symbol,
      lastClose: isValidPrice(lastClose) ? lastClose : null,
      return1M,
      return3M,
      volAnnual,
      sharpe,
    };
  });
}
