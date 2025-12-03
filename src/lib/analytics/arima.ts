/**
 * ARIMA (AutoRegressive Integrated Moving Average) Model Implementation
 * Implements ARIMA(1,1,1) model for time series forecasting
 *
 * ARIMA(p,d,q) where:
 * - p: order of autoregression (AR)
 * - d: degree of differencing (I)
 * - q: order of moving average (MA)
 */

interface ARIMAParameters {
  arCoefficient: number;
  maCoefficient: number;
  intercept: number;
  variance: number;
}

/**
 * Calculate first-order differences of a time series
 */
function difference(series: number[], lag: number = 1): number[] {
  const diffed: number[] = [];
  for (let i = lag; i < series.length; i++) {
    diffed.push(series[i] - series[i - lag]);
  }
  return diffed;
}

/**
 * Reverse differencing to get original scale
 */
function inverseDifference(lastOriginal: number, diffSeries: number[]): number[] {
  const result: number[] = [lastOriginal];
  for (let i = 0; i < diffSeries.length; i++) {
    result.push(result[result.length - 1] + diffSeries[i]);
  }
  return result.slice(1);
}

/**
 * Calculate mean of array
 */
function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate variance of array
 */
function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length;
}

/**
 * Calculate autocorrelation at given lag
 */
function autocorrelation(series: number[], lag: number): number {
  const n = series.length;
  const m = mean(series);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n - lag; i++) {
    numerator += (series[i] - m) * (series[i + lag] - m);
  }

  for (let i = 0; i < n; i++) {
    denominator += Math.pow(series[i] - m, 2);
  }

  return numerator / denominator;
}

/**
 * Estimate AR(1) coefficient using Ordinary Least Squares
 */
function estimateARCoefficient(series: number[]): number {
  const n = series.length;
  if (n < 2) return 0;

  // Calculate means
  const yBar = mean(series.slice(1));
  const xBar = mean(series.slice(0, -1));

  // Calculate coefficient
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n - 1; i++) {
    const x = series[i] - xBar;
    const y = series[i + 1] - yBar;
    numerator += x * y;
    denominator += x * x;
  }

  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Estimate MA(1) coefficient using residuals
 */
function estimateMACoefficient(residuals: number[]): number {
  if (residuals.length < 2) return 0;

  // Use autocorrelation of residuals to estimate MA coefficient
  // For MA(1), the theoretical ACF at lag 1 is: -θ / (1 + θ²)
  // We solve this equation numerically
  const acf1 = autocorrelation(residuals, 1);

  // Simplified estimation: θ ≈ -ACF(1) for small values
  // For more accuracy, we could solve the quadratic equation
  if (Math.abs(acf1) < 0.5) {
    return -acf1;
  }

  // Solve quadratic equation: θ² * acf1 + θ + acf1 = 0
  const a = acf1;
  const b = 1;
  const c = acf1;
  const discriminant = b * b - 4 * a * c;

  if (discriminant >= 0 && a !== 0) {
    const theta1 = (-b + Math.sqrt(discriminant)) / (2 * a);
    const theta2 = (-b - Math.sqrt(discriminant)) / (2 * a);
    // Choose the coefficient with smaller absolute value (invertibility)
    return Math.abs(theta1) < Math.abs(theta2) ? theta1 : theta2;
  }

  return -acf1;
}

/**
 * Fit ARIMA(1,1,1) model to time series data
 */
function fitARIMA(prices: number[]): ARIMAParameters {
  // Step 1: Difference the series (I=1)
  const diffedSeries = difference(prices, 1);

  if (diffedSeries.length < 3) {
    // Not enough data points
    return {
      arCoefficient: 0,
      maCoefficient: 0,
      intercept: mean(diffedSeries),
      variance: variance(diffedSeries)
    };
  }

  // Step 2: Estimate AR(1) coefficient
  const arCoef = estimateARCoefficient(diffedSeries);

  // Step 3: Calculate residuals from AR model
  const residuals: number[] = [];
  const diffMean = mean(diffedSeries);

  for (let i = 1; i < diffedSeries.length; i++) {
    const predicted = diffMean + arCoef * (diffedSeries[i - 1] - diffMean);
    residuals.push(diffedSeries[i] - predicted);
  }

  // Step 4: Estimate MA(1) coefficient
  const maCoef = estimateMACoefficient(residuals);

  // Step 5: Calculate final residual variance
  const finalResiduals: number[] = [];
  let previousError = 0;

  for (let i = 1; i < diffedSeries.length; i++) {
    const arPart = arCoef * (diffedSeries[i - 1] - diffMean);
    const maPart = maCoef * previousError;
    const predicted = diffMean + arPart - maPart;
    const error = diffedSeries[i] - predicted;
    finalResiduals.push(error);
    previousError = error;
  }

  return {
    arCoefficient: arCoef,
    maCoefficient: maCoef,
    intercept: diffMean,
    variance: variance(finalResiduals)
  };
}

/**
 * Generate forecasts using fitted ARIMA model
 */
function generateForecasts(
  lastValues: number[],
  params: ARIMAParameters,
  horizon: number
): number[] {
  const forecasts: number[] = [];
  const errors: number[] = [0]; // Initialize with zero error

  // Start with the last differenced value
  const lastDiffed = lastValues.length > 1
    ? lastValues[lastValues.length - 1] - lastValues[lastValues.length - 2]
    : params.intercept;

  let currentDiffed = lastDiffed;

  for (let h = 0; h < horizon; h++) {
    // ARIMA(1,1,1) forecast equation for differenced series:
    // y_t = c + φ * y_{t-1} + θ * e_{t-1} + e_t
    const arPart = params.arCoefficient * (currentDiffed - params.intercept);
    const maPart = h === 0 ? params.maCoefficient * errors[errors.length - 1] : 0;

    currentDiffed = params.intercept + arPart - maPart;
    forecasts.push(currentDiffed);

    // For future forecasts, the error term is zero (best prediction)
    errors.push(0);
  }

  // Convert differenced forecasts back to original scale
  const lastOriginal = lastValues[lastValues.length - 1];
  return inverseDifference(lastOriginal, forecasts);
}

/**
 * Calculate prediction intervals
 */
function calculatePredictionIntervals(
  forecasts: number[],
  variance: number,
  confidenceLevel: number = 1.96 // 95% confidence
): { upper: number[], lower: number[] } {
  const upper: number[] = [];
  const lower: number[] = [];
  const stdDev = Math.sqrt(variance);

  for (let h = 0; h < forecasts.length; h++) {
    // Variance increases with forecast horizon
    const horizonStdDev = stdDev * Math.sqrt(h + 1);
    const margin = confidenceLevel * horizonStdDev;

    upper.push(forecasts[h] + margin);
    lower.push(forecasts[h] - margin);
  }

  return { upper, lower };
}

/**
 * Main ARIMA forecast function
 * Implements ARIMA(1,1,1) model for time series forecasting
 */
export function arimaForecast(
  prices: number[],
  horizon: number
): {
  forecast: number[],
  upperBound: number[],
  lowerBound: number[],
  parameters?: ARIMAParameters
} {
  // Validate input
  if (prices.length < 4) {
    // Not enough data for ARIMA, fall back to simple forecast
    const lastPrice = prices[prices.length - 1];
    const forecast = Array(horizon).fill(lastPrice);
    const margin = lastPrice * 0.1; // 10% margin

    return {
      forecast,
      upperBound: forecast.map(v => v + margin),
      lowerBound: forecast.map(v => v - margin)
    };
  }

  try {
    // Step 1: Fit ARIMA model
    const params = fitARIMA(prices);

    // Step 2: Generate forecasts
    const forecasts = generateForecasts(prices, params, horizon);

    // Step 3: Calculate prediction intervals
    const { upper, lower } = calculatePredictionIntervals(forecasts, params.variance);

    // Step 4: Ensure forecasts are reasonable (not negative for stock prices)
    const adjustedForecasts = forecasts.map(f => Math.max(f, 0.01));
    const adjustedLower = lower.map(l => Math.max(l, 0.01));
    const adjustedUpper = upper.map(u => Math.max(u, adjustedLower[0]));

    return {
      forecast: adjustedForecasts,
      upperBound: adjustedUpper,
      lowerBound: adjustedLower,
      parameters: params
    };
  } catch (error) {
    console.error('ARIMA forecast error:', error);

    // Fallback to simple forecast
    const lastPrice = prices[prices.length - 1];
    const trend = prices.length > 1 ? prices[prices.length - 1] - prices[prices.length - 2] : 0;
    const forecast: number[] = [];

    for (let i = 1; i <= horizon; i++) {
      forecast.push(lastPrice + trend * i * 0.5); // Damped trend
    }

    const margin = Math.abs(trend) * 2 || lastPrice * 0.1;

    return {
      forecast,
      upperBound: forecast.map((v, i) => v + margin * Math.sqrt(i + 1)),
      lowerBound: forecast.map((v, i) => Math.max(v - margin * Math.sqrt(i + 1), 0.01))
    };
  }
}

/**
 * Get ARIMA model description
 */
export function getARIMADescription(params?: ARIMAParameters): string {
  if (!params) {
    return 'ARIMA(1,1,1) Model';
  }

  return `ARIMA(1,1,1): AR=${params.arCoefficient.toFixed(3)}, MA=${params.maCoefficient.toFixed(3)}`;
}