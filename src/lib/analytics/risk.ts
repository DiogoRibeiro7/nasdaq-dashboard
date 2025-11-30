import type { DatedReturn } from "@/lib/stats";

export type VarEsResult = {
  horizonDays: number;
  confidence: number;
  varHist: number | null;
  esHist: number | null;
  varNorm: number | null;
  esNorm: number | null;
};

export function computeVarEs(
  returns: DatedReturn[],
  horizonDays: number,
  confidence: number,
): VarEsResult {
  const horizon = Math.max(1, Math.trunc(horizonDays));
  const alpha = 1 - confidence;

  const logReturns = returns
    .map((point) => point.r)
    .filter((value) => Number.isFinite(value));

  const horizonLogReturns = rollLogReturns(logReturns, horizon);
  const horizonSimpleReturns = horizonLogReturns.map(
    (value) => Math.exp(value) - 1,
  );

  const { varHist, esHist } = computeHistoricalVaR(
    horizonSimpleReturns,
    alpha,
  );

  const { mean, std } = computeMeanStd(logReturns);
  const muH = mean * horizon;
  const sigmaH = std * Math.sqrt(horizon);

  let varNorm: number | null = null;
  let esNorm: number | null = null;

  if (sigmaH > 0 && Number.isFinite(muH)) {
    const z = inverseNormalCDF(alpha);
    const vaRLog = muH + sigmaH * z;
    const esLog = muH - (sigmaH * standardNormalPDF(z)) / alpha;
    varNorm = Math.max(0, -(Math.exp(vaRLog) - 1));
    esNorm = Math.max(0, -(Math.exp(esLog) - 1));
  }

  return {
    horizonDays: horizon,
    confidence,
    varHist,
    esHist,
    varNorm,
    esNorm,
  };
}

function rollLogReturns(values: number[], horizon: number): number[] {
  if (values.length < horizon) {
    return [];
  }
  const result: number[] = [];
  let windowSum = 0;
  for (let i = 0; i < values.length; i++) {
    windowSum += values[i];
    if (i >= horizon) {
      windowSum -= values[i - horizon];
    }
    if (i >= horizon - 1) {
      result.push(windowSum);
    }
  }
  return result;
}

function computeHistoricalVaR(
  returns: number[],
  alpha: number,
): { varHist: number | null; esHist: number | null } {
  if (returns.length === 0) {
    return { varHist: null, esHist: null };
  }
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(alpha * sorted.length)),
  );
  const quantile = sorted[index];
  const varHist = Math.max(0, -quantile);
  const tail = sorted.filter((value) => value <= quantile);
  const esHist =
    tail.length > 0
      ? Math.max(0, -tail.reduce((sum, value) => sum + value, 0) / tail.length)
      : null;
  return { varHist, esHist };
}

function computeMeanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) {
    return { mean: 0, std: 0 };
  }
  const mean =
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, values.length - 1);
  return {
    mean,
    std: variance > 0 ? Math.sqrt(variance) : 0,
  };
}

function inverseNormalCDF(p: number): number {
  if (p <= 0 || p >= 1) {
    return NaN;
  }

  const a1 = -39.6968302866538;
  const a2 = 220.946098424521;
  const a3 = -275.928510446969;
  const a4 = 138.357751867269;
  const a5 = -30.6647980661472;
  const a6 = 2.50662827745924;

  const b1 = -54.4760987982241;
  const b2 = 161.585836858041;
  const b3 = -155.698979859887;
  const b4 = 66.8013118877197;
  const b5 = -13.2806815528857;

  const c1 = -0.00778489400243029;
  const c2 = -0.322396458041136;
  const c3 = -2.40075827716184;
  const c4 = -2.54973253934373;
  const c5 = 4.37466414146497;
  const c6 = 2.93816398269878;

  const d1 = 0.00778469570904146;
  const d2 = 0.32246712907004;
  const d3 = 2.445134137143;
  const d4 = 3.75440866190742;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  if (p > pHigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  q = p - 0.5;
  r = q * q;
  return (
    (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
    (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  );
}

function standardNormalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
