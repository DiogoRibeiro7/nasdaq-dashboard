import type { DatedReturn } from "@/lib/stats";

export type FactorSeriesPoint = {
  date: string;
  values: number[];
};

export type FactorSeries = FactorSeriesPoint[];

export type FactorRegressionResult = {
  symbol: string;
  betas: number[];
  intercept: number;
  residualStd: number;
  r2: number;
};

export type FactorDefinition = {
  symbol: string;
  name: string;
};

export function runFactorRegression(
  assetReturns: DatedReturn[],
  factors: FactorSeries,
  options?: { symbol?: string },
): FactorRegressionResult | null {
  if (assetReturns.length === 0 || factors.length === 0) {
    return null;
  }

  const factorDimension = factors[0].values.length;
  if (factorDimension === 0) {
    return null;
  }

  const factorMap = new Map<string, number[]>();
  for (const point of factors) {
    if (point.values.length === factorDimension) {
      factorMap.set(point.date, point.values);
    }
  }

  const alignedReturns: number[] = [];
  const alignedFactors: number[][] = [];

  for (const point of assetReturns) {
    const factorValues = factorMap.get(point.date);
    if (!factorValues) {
      continue;
    }
    if (!Number.isFinite(point.r) || factorValues.some((value) => !Number.isFinite(value))) {
      continue;
    }
    alignedReturns.push(point.r);
    alignedFactors.push(factorValues);
  }

  const observations = alignedReturns.length;
  const parameterCount = factorDimension + 1; // intercept + betas

  if (observations <= parameterCount) {
    return null;
  }

  const xtx = createZeroMatrix(parameterCount);
  const xty = new Array<number>(parameterCount).fill(0);

  for (let idx = 0; idx < observations; idx++) {
    const y = alignedReturns[idx];
    const factorsRow = alignedFactors[idx];
    const row = [1, ...factorsRow];

    for (let i = 0; i < parameterCount; i++) {
      xty[i] += row[i] * y;
      for (let j = i; j < parameterCount; j++) {
        xtx[i][j] += row[i] * row[j];
      }
    }
  }

  // Fill lower triangular part from upper because matrix is symmetric
  for (let i = 0; i < parameterCount; i++) {
    for (let j = 0; j < i; j++) {
      xtx[i][j] = xtx[j][i];
    }
  }

  const coeffs = solveLinearSystem(xtx, xty);
  if (!coeffs) {
    return null;
  }

  const intercept = coeffs[0];
  const betas = coeffs.slice(1);

  const predictions: number[] = [];
  const residuals: number[] = [];
  let sumY = 0;

  for (let idx = 0; idx < observations; idx++) {
    const y = alignedReturns[idx];
    let estimate = intercept;
    const factorsRow = alignedFactors[idx];
    for (let j = 0; j < betas.length; j++) {
      estimate += betas[j] * factorsRow[j];
    }
    predictions.push(estimate);
    const residual = y - estimate;
    residuals.push(residual);
    sumY += y;
  }

  const sse = residuals.reduce((sum, value) => sum + value * value, 0);
  const meanY = sumY / observations;
  const sst = alignedReturns.reduce(
    (sum, value) => sum + (value - meanY) * (value - meanY),
    0,
  );
  const r2 = sst > 0 ? Math.max(0, 1 - sse / sst) : 1;
  const dof = observations - parameterCount;
  if (dof <= 0) {
    return null;
  }
  const residualStd = Math.sqrt(sse / dof);

  return {
    symbol: options?.symbol ?? "",
    betas,
    intercept,
    residualStd,
    r2,
  };
}

export function buildFactorSeriesFromReturns(
  configs: FactorDefinition[],
  returnsBySymbol: Record<string, DatedReturn[]>,
): { series: FactorSeries; factorNames: string[] } {
  const activeConfigs = configs.filter(
    (config) => (returnsBySymbol[config.symbol]?.length ?? 0) > 0,
  );

  if (activeConfigs.length === 0) {
    return { series: [], factorNames: [] };
  }

  const factorMaps = activeConfigs.map((config) => {
    const series = returnsBySymbol[config.symbol] ?? [];
    return new Map(series.map((point) => [point.date, point.r]));
  });

  let commonDates: Set<string> | null = null;

  for (const map of factorMaps) {
    const keys = new Set<string>(map.keys());
    if (commonDates === null) {
      commonDates = keys;
      continue;
    }
    const intersection = new Set<string>();
    for (const date of commonDates) {
      if (keys.has(date)) {
        intersection.add(date);
      }
    }
    commonDates = intersection;
  }

  if (!commonDates || commonDates.size === 0) {
    return { series: [], factorNames: activeConfigs.map((config) => config.name) };
  }

  const sortedDates = [...commonDates].sort();
  const series: FactorSeries = [];

  for (const date of sortedDates) {
    const values: number[] = [];
    let valid = true;
    for (const map of factorMaps) {
      const value = map.get(date);
      if (value === undefined || !Number.isFinite(value)) {
        valid = false;
        break;
      }
      values.push(value);
    }
    if (valid) {
      series.push({ date, values });
    }
  }

  return {
    series,
    factorNames: activeConfigs.map((config) => config.name),
  };
}

function createZeroMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => new Array<number>(size).fill(0));
}

function solveLinearSystem(
  matrix: number[][],
  vector: number[],
): number[] | null {
  const n = matrix.length;
  const a = matrix.map((row) => [...row]);
  const b = [...vector];

  for (let i = 0; i < n; i++) {
    // Pivot
    let pivotRow = i;
    let pivotValue = Math.abs(a[i][i]);
    for (let j = i + 1; j < n; j++) {
      const candidate = Math.abs(a[j][i]);
      if (candidate > pivotValue) {
        pivotValue = candidate;
        pivotRow = j;
      }
    }

    if (pivotValue < 1e-12) {
      return null;
    }

    if (pivotRow !== i) {
      [a[i], a[pivotRow]] = [a[pivotRow], a[i]];
      [b[i], b[pivotRow]] = [b[pivotRow], b[i]];
    }

    const pivot = a[i][i];
    for (let j = i + 1; j < n; j++) {
      const factor = a[j][i] / pivot;
      for (let k = i; k < n; k++) {
        a[j][k] -= factor * a[i][k];
      }
      b[j] -= factor * b[i];
    }
  }

  const solution = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= a[i][j] * solution[j];
    }
    const pivot = a[i][i];
    if (Math.abs(pivot) < 1e-12) {
      return null;
    }
    solution[i] = sum / pivot;
  }

  return solution;
}
