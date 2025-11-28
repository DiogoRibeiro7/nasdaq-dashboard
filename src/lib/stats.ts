import type { AlphaVantageTimeSeriesPoint } from "./alphaVantage";

export type StockStats = {
  lastClose: number;
  oneMonthReturn: number | null;
  threeMonthReturn: number | null;
  annualizedVolatility: number | null;
};

/**
 * Compute basic statistics from a time series.
 * Assumes daily data sorted in ascending order by date.
 */
export function computeStats(
  series: AlphaVantageTimeSeriesPoint[],
): StockStats {
  if (series.length === 0) {
    return {
      lastClose: NaN,
      oneMonthReturn: null,
      threeMonthReturn: null,
      annualizedVolatility: null,
    };
  }

  if (series.length === 1) {
    return {
      lastClose: series[0].close,
      oneMonthReturn: null,
      threeMonthReturn: null,
      annualizedVolatility: null,
    };
  }

  const closes = series.map((s) => s.close);
  const lastClose = closes[closes.length - 1];

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const r = Math.log(closes[i] / closes[i - 1]);
    returns.push(r);
  }

  const mean =
    returns.reduce((acc, r) => acc + r, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) /
    (returns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualizedVolatility = dailyVol * Math.sqrt(252);

  const idxMinus = (days: number): number | null => {
    const idx = closes.length - 1 - days;
    return idx >= 0 ? idx : null;
  };

  const oneMonthIdx = idxMinus(21);
  const threeMonthIdx = idxMinus(63);

  const oneMonthReturn =
    oneMonthIdx !== null
      ? closes[closes.length - 1] / closes[oneMonthIdx] - 1
      : null;

  const threeMonthReturn =
    threeMonthIdx !== null
      ? closes[closes.length - 1] / closes[threeMonthIdx] - 1
      : null;

  return {
    lastClose,
    oneMonthReturn,
    threeMonthReturn,
    annualizedVolatility,
  };
}
