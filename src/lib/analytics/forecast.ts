export type ForecastPoint = {
  date: string;
  point: number;
  lower: number | null;
  upper: number | null;
};

export type ForecastModelType = "naive" | "rolling_mean" | "ewma";

export type ForecastOptions = {
  rollingWindow?: number;
  ewmaLambda?: number;
  confidenceLevel?: number;
};

const DEFAULT_ROLLING_WINDOW = 20;
const DEFAULT_EWMA_LAMBDA = 0.2;
const DEFAULT_CONFIDENCE = 0.95;
const TRADING_DAYS_PER_YEAR = 252;

function addDays(date: string, days: number): string {
  const base = new Date(date);
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = `${base.getMonth() + 1}`.padStart(2, "0");
  const day = `${base.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function forecastPrices(
  history: { date: string; close: number }[],
  horizonDays: number,
  model: ForecastModelType,
  options: ForecastOptions = {},
): ForecastPoint[] {
  if (history.length === 0 || horizonDays <= 0) {
    return [];
  }

  const rollingWindow = options.rollingWindow ?? DEFAULT_ROLLING_WINDOW;
  const ewmaLambda = options.ewmaLambda ?? DEFAULT_EWMA_LAMBDA;
  const confidenceLevel = options.confidenceLevel ?? DEFAULT_CONFIDENCE;

  const sorted = [...history].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const lastClose = sorted[sorted.length - 1].close;
  const lastDate = sorted[sorted.length - 1].date;

  const closes = sorted.map((point) => point.close);
  const logReturns = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    }
  }

  const sigma = sampleStdDev(logReturns);

  let currentValue = lastClose;
  let currentIndex = sorted.length - 1;
  let ewma = lastClose;

  const forecasts: ForecastPoint[] = [];

  for (let step = 1; step <= horizonDays; step++) {
    let point = currentValue;

    if (model === "naive") {
      point = currentValue;
    } else if (model === "rolling_mean") {
      const start = Math.max(0, currentIndex - rollingWindow + 1);
      const windowSlice = closes.slice(start, currentIndex + 1);
      const mean =
        windowSlice.reduce((sum, value) => sum + value, 0) /
        windowSlice.length;
      point = mean;
    } else if (model === "ewma") {
      ewma = ewmaLambda * currentValue + (1 - ewmaLambda) * ewma;
      point = ewma;
    }

    currentValue = point;
    currentIndex = Math.min(currentIndex + 1, closes.length - 1);

    const forecastDate = addDays(lastDate, step);

    let lower: number | null = null;
    let upper: number | null = null;
    if (sigma !== null && Number.isFinite(sigma) && sigma > 0) {
      const z = inverseNormalCDF((1 + confidenceLevel) / 2);
      const variance = sigma * Math.sqrt(step);
      const logPoint = Math.log(point);
      lower = Math.exp(logPoint - z * variance);
      upper = Math.exp(logPoint + z * variance);
    }

    forecasts.push({
      date: forecastDate,
      point,
      lower,
      upper,
    });
  }

  return forecasts;
}

/**
 * Approximation of the inverse normal CDF (probit).
 */
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

function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);
  return variance >= 0 ? Math.sqrt(variance) : null;
}
