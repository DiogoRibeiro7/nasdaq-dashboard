import { backtestSignals } from "@/lib/analytics/backtest";
import { computeMovingAverage } from "@/lib/stats";
import { generateMaCrossoverSignals } from "@/lib/analytics/backtest";

export type ParamGrid1D = {
  name: string;
  values: number[];
};

export type ParamGrid2D = {
  x: ParamGrid1D;
  y: ParamGrid1D;
};

export type RobustnessMetric = "totalReturn" | "cagr" | "maxDrawdown" | "sharpe";

export type RobustnessSurfacePoint = {
  x: number;
  y: number;
  metrics: {
    totalReturn: number | null;
    cagr: number | null;
    maxDrawdown: number | null;
    sharpe: number | null;
  };
};

const TRADING_DAYS_PER_YEAR = 252;

export function computeMaRobustnessSurface(
  prices: { date: string; close: number }[],
  grid: ParamGrid2D,
): RobustnessSurfacePoint[] {
  if (prices.length === 0) {
    return [];
  }

  const points: RobustnessSurfacePoint[] = [];

  for (const shortWindow of grid.x.values) {
    for (const longWindow of grid.y.values) {
      if (shortWindow >= longWindow) {
        continue;
      }
      const metrics = evaluateMaStrategy(prices, shortWindow, longWindow);
      points.push({ x: shortWindow, y: longWindow, metrics });
    }
  }

  return points;
}

function evaluateMaStrategy(
  prices: { date: string; close: number }[],
  shortWindow: number,
  longWindow: number,
): RobustnessSurfacePoint["metrics"] {
  if (prices.length < longWindow || shortWindow <= 0 || longWindow <= 0) {
    return emptyMetrics();
  }

  const maData = computeDualMA(prices, shortWindow, longWindow);
  if (maData.length === 0) {
    return emptyMetrics();
  }

  const signals = generateMaCrossoverSignals(maData);
  const backtest = backtestSignals(prices, signals);

  if (!backtest) {
    return emptyMetrics();
  }

  const returns = computeDailyReturns(prices, signals);
  const sharpe = computeSharpeFromReturns(returns);

  return {
    totalReturn: backtest.totalReturn,
    cagr: backtest.cagr,
    maxDrawdown: backtest.maxDrawdown,
    sharpe,
  };
}

function emptyMetrics(): RobustnessSurfacePoint["metrics"] {
  return {
    totalReturn: null,
    cagr: null,
    maxDrawdown: null,
    sharpe: null,
  };
}

function computeDualMA(
  series: { date: string; close: number }[],
  shortWindow: number,
  longWindow: number,
) {
  const shortMa = computeMovingAverage(series, shortWindow);
  const longMa = computeMovingAverage(series, longWindow);

  if (shortMa.length !== series.length || longMa.length !== series.length) {
    return [];
  }

  return series.map((point, index) => ({
    date: point.date,
    close: point.close,
    maShort: shortMa[index]?.ma ?? null,
    maLong: longMa[index]?.ma ?? null,
  }));
}

function computeDailyReturns(
  prices: { date: string; close: number }[],
  positions: { date: string; position: -1 | 0 | 1 }[],
): number[] {
  const positionMap = new Map(positions.map((point) => [point.date, point.position]));
  const sortedPrices = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const returns: number[] = [];

  for (let i = 0; i < sortedPrices.length - 1; i++) {
    const currentDate = sortedPrices[i].date;
    const currentPrice = sortedPrices[i].close;
    const nextPrice = sortedPrices[i + 1].close;

    const position = positionMap.get(currentDate) ?? 0;
    if (currentPrice <= 0 || nextPrice <= 0) {
      returns.push(0);
      continue;
    }

    const ret = nextPrice / currentPrice - 1;
    returns.push(position * ret);
  }

  return returns;
}

function computeSharpeFromReturns(returns: number[]): number | null {
  if (returns.length === 0) {
    return null;
  }
  const mean =
    returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, returns.length - 1);
  const std = Math.sqrt(Math.max(variance, 0));

  if (std === 0) {
    return null;
  }

  const meanAnnual = mean * TRADING_DAYS_PER_YEAR;
  const stdAnnual = std * Math.sqrt(TRADING_DAYS_PER_YEAR);
  return stdAnnual > 0 ? meanAnnual / stdAnnual : null;
}
