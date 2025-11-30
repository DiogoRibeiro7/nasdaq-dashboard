import type { DatedReturn } from "@/lib/stats";

const TRADING_DAYS_PER_YEAR = 252;
const MAX_SYMBOLS = 6;
const DEFAULT_RISK_FREE_RATE = 0;

export type FrontierPoint = {
  /** Annualised volatility (standard deviation of returns) */
  volatility: number;
  /** Annualised expected return */
  expectedReturn: number;
  /** Portfolio weights keyed by symbol */
  weights: Record<string, number>;
};

export type OptimisationInputs = {
  symbols: string[];
  returnsBySymbol: Record<string, DatedReturn[]>;
};

/**
 * Builds an approximate efficient frontier using deterministic random sampling of weights.
 *
 * The search is intentionally simple to keep computation transparent. We:
 *  - limit the number of assets considered to keep runtime manageable
 *  - align daily log returns across all assets
 *  - generate a diverse set of candidate weight vectors (long-only by default)
 *  - evaluate the annualised mean/volatility for each candidate
 */
export function computeEfficientFrontier(
  input: OptimisationInputs,
  numPoints: number,
  options?: {
    riskFreeRateAnnual?: number;
    allowShortSelling?: boolean;
  },
): FrontierPoint[] {
  const allowShortSelling = options?.allowShortSelling ?? false;

  const availableSymbols = input.symbols.filter(
    (symbol) => (input.returnsBySymbol[symbol]?.length ?? 0) > 0,
  );
  const symbols = availableSymbols.slice(0, MAX_SYMBOLS);

  if (symbols.length < 2) {
    return [];
  }

  const alignedReturns = alignReturns(symbols, input.returnsBySymbol);

  if (alignedReturns.length < 2) {
    return [];
  }

  const totalSamples = Math.max(5, numPoints);
  const weightSamples = generateWeightSamples(
    symbols.length,
    totalSamples,
    allowShortSelling,
  );

  const frontier: FrontierPoint[] = [];

  for (const weights of weightSamples) {
    const point = evaluateCandidate(symbols, alignedReturns, weights);
    if (point) {
      frontier.push(point);
    }
  }

  frontier.sort((a, b) => a.volatility - b.volatility);

  return frontier.slice(0, Math.max(1, numPoints));
}

export function findMinVariancePortfolio(
  frontier: FrontierPoint[],
): FrontierPoint | null {
  if (frontier.length === 0) {
    return null;
  }
  return frontier.reduce((best, point) =>
    point.volatility < best.volatility ? point : best,
  );
}

export function findMaxSharpePortfolio(
  frontier: FrontierPoint[],
  riskFreeRateAnnual: number = DEFAULT_RISK_FREE_RATE,
): FrontierPoint | null {
  let best: FrontierPoint | null = null;
  let bestSharpe = -Infinity;

  for (const point of frontier) {
    if (point.volatility <= 0) {
      continue;
    }
    const sharpe = (point.expectedReturn - riskFreeRateAnnual) / point.volatility;
    if (sharpe > bestSharpe) {
      bestSharpe = sharpe;
      best = point;
    }
  }

  return best;
}

function alignReturns(
  symbols: string[],
  returnsBySymbol: Record<string, DatedReturn[]>,
): number[][] {
  const maps = symbols.map((symbol) => {
    const series = returnsBySymbol[symbol] ?? [];
    return new Map(series.map((point) => [point.date, point.r]));
  });

  if (maps.some((map) => map.size === 0)) {
    return [];
  }

  let commonDates = new Set<string>(maps[0].keys());

  for (let i = 1; i < maps.length; i++) {
    const current = new Set(maps[i].keys());
    commonDates = new Set(
      [...commonDates].filter((date) => current.has(date)),
    );
  }

  const sortedDates = [...commonDates].sort();
  const aligned: number[][] = [];

  for (const date of sortedDates) {
    const row: number[] = [];
    let valid = true;
    for (const map of maps) {
      const value = map.get(date);
      if (value === undefined || !Number.isFinite(value)) {
        valid = false;
        break;
      }
      row.push(value);
    }
    if (valid) {
      aligned.push(row);
    }
  }

  return aligned;
}

function evaluateCandidate(
  symbols: string[],
  alignedReturns: number[][],
  weights: number[],
): FrontierPoint | null {
  const n = alignedReturns.length;
  if (n === 0) {
    return null;
  }

  const portfolioReturns = alignedReturns.map((row) =>
    row.reduce((sum, value, idx) => sum + value * weights[idx], 0),
  );

  const meanDaily =
    portfolioReturns.reduce((sum, value) => sum + value, 0) / n;
  const variance =
    portfolioReturns.reduce(
      (sum, value) => sum + (value - meanDaily) ** 2,
      0,
    ) / Math.max(1, n - 1);

  if (!Number.isFinite(meanDaily) || !Number.isFinite(variance) || variance < 0) {
    return null;
  }

  const expectedReturn = meanDaily * TRADING_DAYS_PER_YEAR;
  const volatility =
    Math.sqrt(Math.max(variance, 0)) * Math.sqrt(TRADING_DAYS_PER_YEAR);

  if (!Number.isFinite(expectedReturn) || !Number.isFinite(volatility)) {
    return null;
  }

  const weightsRecord: Record<string, number> = {};
  symbols.forEach((symbol, idx) => {
    weightsRecord[symbol] = weights[idx];
  });

  return {
    volatility,
    expectedReturn,
    weights: weightsRecord,
  };
}

function generateWeightSamples(
  dimension: number,
  count: number,
  allowShortSelling: boolean,
): number[][] {
  const rng = createDeterministicRng(123456789);
  const samples: number[][] = [];

  // Include corner portfolios and equal weight baseline
  for (let i = 0; i < dimension; i++) {
    const weights = new Array(dimension).fill(0);
    weights[i] = 1;
    samples.push(weights);
  }
  samples.push(new Array(dimension).fill(1 / dimension));

  while (samples.length < count) {
    const weights = allowShortSelling
      ? sampleShortWeights(dimension, rng)
      : sampleLongOnlyWeights(dimension, rng);
    samples.push(weights);
  }

  return samples.slice(0, count);
}

function sampleLongOnlyWeights(
  dimension: number,
  rng: () => number,
): number[] {
  const raw = Array.from({ length: dimension }, () => rng());
  const sum = raw.reduce((acc, value) => acc + value, 0);
  if (sum === 0) {
    return new Array(dimension).fill(1 / dimension);
  }
  return raw.map((value) => value / sum);
}

function sampleShortWeights(
  dimension: number,
  rng: () => number,
): number[] {
  const raw = Array.from({ length: dimension }, () => rng() * 2 - 1);
  let sum = raw.reduce((acc, value) => acc + value, 0);
  if (Math.abs(sum) < 1e-6) {
    sum = 1;
  }
  return raw.map((value) => value / sum);
}

function createDeterministicRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}
