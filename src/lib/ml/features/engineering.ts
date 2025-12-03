import type { StockTimeSeriesPoint } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enriched OHLCV record used for feature generation.
 */
export type StockData = StockTimeSeriesPoint & {
  symbol: string;
  sector?: string;
  /** Optional benchmark close used if context is not provided */
  benchmarkClose?: number;
  /** Optional sector benchmark close used for relative features */
  sectorBenchmarkClose?: number;
};

/**
 * Optional context that allows the pipeline to include cross-sectional signals.
 */
export type FeatureEngineeringContext = {
  benchmarkSeries?: StockTimeSeriesPoint[];
  sectorSeries?: StockTimeSeriesPoint[];
};

/**
 * Configuration for the feature pipeline.
 */
export type FeatureEngineeringOptions = {
  horizons?: number[];
  rsiPeriod?: number;
  macd?: { fast: number; slow: number; signal: number };
  bollinger?: { period: number; stdDev: number };
  volatilityWindows?: number[];
  momentumWindows?: number[];
  correlationWindow?: number;
  sectorLookback?: number;
  vwapWindow?: number;
};

/**
 * Result of the pipeline transformation.
 */
export type FeatureEngineeringResult = {
  featureMatrix: number[][];
  featureNames: string[];
  targetMatrix: (number | null)[][];
  targetNames: string[];
  dates: string[];
  metadata: {
    symbol: string;
    sector?: string;
  };
  context?: FeatureEngineeringContext;
};

/**
 * Feature importance entry used by the LSTM module and the UI.
 */
export type FeatureImportance = {
  feature: string;
  score: number;
  normalized: number;
};

const DEFAULT_OPTIONS: Required<Omit<FeatureEngineeringOptions, "macd" | "bollinger">> &
  Pick<FeatureEngineeringOptions, "macd" | "bollinger"> = {
  horizons: [1, 5, 10, 20],
  rsiPeriod: 14,
  macd: { fast: 12, slow: 26, signal: 9 },
  bollinger: { period: 20, stdDev: 2 },
  volatilityWindows: [21, 63],
  momentumWindows: [10, 20, 60],
  correlationWindow: 20,
  sectorLookback: 15,
  vwapWindow: 20,
};

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds OHLCV + technical indicator features required by the LSTM model.
 */
export class FeatureEngineeringPipeline {
  private readonly options: typeof DEFAULT_OPTIONS;

  constructor(options: FeatureEngineeringOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    if (options.macd) {
      this.options.macd = options.macd;
    }
    if (options.bollinger) {
      this.options.bollinger = options.bollinger;
    }
  }

  /**
   * Transforms a chronologically ordered stock series into numerical features.
   */
  transform(
    rawData: StockData[],
    context: FeatureEngineeringContext = {},
  ): FeatureEngineeringResult {
    if (rawData.length < 80) {
      throw new Error(
        "FeatureEngineeringPipeline: need at least 80 observations to derive stable indicators",
      );
    }

    const data = [...rawData].sort((a, b) => a.date.localeCompare(b.date));
    const closes = data.map((point) => point.close);
    const opens = data.map((point) => point.open);
    const highs = data.map((point) => point.high);
    const lows = data.map((point) => point.low);
    const volumes = data.map((point) => point.volume);

    const benchmarkCloses = this.alignSeries(data, context.benchmarkSeries, (p) =>
      p.benchmarkClose ?? p.close,
    );
    const sectorCloses = this.alignSeries(data, context.sectorSeries, (p) =>
      p.sectorBenchmarkClose ?? p.close,
    );

    const returns = calcReturns(closes);
    const logReturns = calcLogReturns(closes);
    const benchmarkReturns = calcReturns(benchmarkCloses);
    const sectorReturns = calcReturns(sectorCloses);

    const { macdLine, signalLine, histogram } = computeMacd(
      closes,
      this.options.macd,
    );
    const rsi = computeRsi(closes, this.options.rsiPeriod);
    const bollinger = computeBollinger(
      closes,
      this.options.bollinger.period,
      this.options.bollinger.stdDev,
    );
    const vwap = computeVwap(closes, highs, lows, volumes, this.options.vwapWindow);
    const obv = computeObv(closes, volumes);
    const obvMax = Math.max(...obv.map((value) => Math.abs(value))) || 1;
    const normalizedObv = obv.map((value) => value / obvMax);
    const volumeRoc = computeRateOfChange(volumes, 10);
    const volatility21 = rollingStd(logReturns, this.options.volatilityWindows[0]);
    const volatility63 = rollingStd(
      logReturns,
      this.options.volatilityWindows[1] ?? 63,
    );
    const sharpe21 = rollingSharpe(logReturns, this.options.volatilityWindows[0]);
    const sharpe63 = rollingSharpe(
      logReturns,
      this.options.volatilityWindows[1] ?? 63,
    );
    const momentum10 = rollingMomentum(closes, this.options.momentumWindows[0]);
    const momentum20 = rollingMomentum(closes, this.options.momentumWindows[1]);
    const momentum60 = rollingMomentum(closes, this.options.momentumWindows[2]);

    const drawdown = computeDrawdown(closes);
    const kurtosis21 = rollingKurtosis(logReturns, 21);
    const skew21 = rollingSkewness(logReturns, 21);

    const corrBenchmark = rollingCorrelation(
      logReturns,
      benchmarkReturns,
      this.options.correlationWindow,
    );
    const betaBenchmark = rollingBeta(
      logReturns,
      benchmarkReturns,
      this.options.correlationWindow,
    );
    const sectorRelative = computeSectorRelativePerformance(
      returns,
      sectorReturns,
      this.options.sectorLookback,
    );

    const bidAskProxy = highs.map((high, idx) =>
      safeNumber((high - lows[idx]) / Math.max(1, closes[idx])),
    );
    const volumeImbalance = computeVolumeImbalance(
      volumes,
      returns,
      this.options.volatilityWindows[0],
    );
    const vwapDeviation = closes.map((close, idx) => {
      const ref = vwap[idx] || close;
      return safeNumber((close - ref) / ref);
    });

    const highLowRatio = highs.map((high, idx) =>
      safeNumber(high / Math.max(lows[idx], 1)),
    );
    const closeOpenRatio = closes.map((close, idx) =>
      safeNumber(close / Math.max(opens[idx], 1)),
    );

    const featureNames = [
      "open",
      "high",
      "low",
      "close",
      "volume",
      "daily_return",
      "log_return",
      "close_to_open",
      "high_to_low",
      "momentum_10",
      "momentum_20",
      "momentum_60",
      "volatility_21",
      "volatility_63",
      "sharpe_21",
      "sharpe_63",
      "obv_normalized",
      "volume_rate_change",
      "vwap_deviation",
      "rsi_14",
      "macd_line",
      "macd_signal",
      "macd_histogram",
      "bollinger_percent_b",
      "bollinger_bandwidth",
      "bid_ask_proxy",
      "volume_imbalance",
      "sector_relative_perf",
      "corr_benchmark",
      "beta_benchmark",
      "drawdown_depth",
      "kurtosis_21",
      "skew_21",
    ];

    const featureMatrix = data.map((_point, idx) => [
      safeNumber(opens[idx]),
      safeNumber(highs[idx]),
      safeNumber(lows[idx]),
      safeNumber(closes[idx]),
      safeNumber(volumes[idx]),
      safeNumber(returns[idx]),
      safeNumber(logReturns[idx]),
      safeNumber(closeOpenRatio[idx]),
      safeNumber(highLowRatio[idx]),
      safeNumber(momentum10[idx]),
      safeNumber(momentum20[idx]),
      safeNumber(momentum60[idx]),
      safeNumber(volatility21[idx]),
      safeNumber(volatility63[idx]),
      safeNumber(sharpe21[idx]),
      safeNumber(sharpe63[idx]),
      safeNumber(normalizedObv[idx]),
      safeNumber(volumeRoc[idx]),
      safeNumber(vwapDeviation[idx]),
      safeNumber(rsi[idx]),
      safeNumber(macdLine[idx]),
      safeNumber(signalLine[idx]),
      safeNumber(histogram[idx]),
      safeNumber(bollinger.percentB[idx]),
      safeNumber(bollinger.bandwidth[idx]),
      safeNumber(bidAskProxy[idx]),
      safeNumber(volumeImbalance[idx]),
      safeNumber(sectorRelative[idx]),
      safeNumber(corrBenchmark[idx]),
      safeNumber(betaBenchmark[idx]),
      safeNumber(drawdown[idx]),
      safeNumber(kurtosis21[idx]),
      safeNumber(skew21[idx]),
    ]);

    const horizons = this.options.horizons;
    const targetNames = horizons.map((horizon) => `return_h${horizon}`);
    const targetMatrix = closes.map((_value, idx) =>
      horizons.map((horizon) => {
        const futureIdx = idx + horizon;
        if (futureIdx >= closes.length) {
          return null;
        }
        const base = closes[idx];
        const future = closes[futureIdx];
        if (base === 0) {
          return null;
        }
        return (future - base) / base;
      }),
    );

    return {
      featureMatrix,
      featureNames,
      targetMatrix,
      targetNames,
      dates: data.map((point) => point.date),
      metadata: {
        symbol: data[data.length - 1]?.symbol ?? "UNKNOWN",
        sector: data[data.length - 1]?.sector,
      },
      context,
    };
  }

  private alignSeries(
    data: StockData[],
    contextSeries: StockTimeSeriesPoint[] | undefined,
    fallback: (point: StockData) => number,
  ): number[] {
    if (!contextSeries || contextSeries.length === 0) {
      return data.map((point) => fallback(point));
    }

    const lookup = new Map(
      contextSeries
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((point) => [point.date, point.close]),
    );

    return data.map((point) => lookup.get(point.date) ?? fallback(point));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature helpers
// ─────────────────────────────────────────────────────────────────────────────

function calcReturns(values: number[]): number[] {
  return values.map((value, idx) => {
    if (idx === 0) {
      return 0;
    }
    const prev = values[idx - 1];
    if (!Number.isFinite(prev) || prev === 0) {
      return 0;
    }
    return (value - prev) / prev;
  });
}

function calcLogReturns(values: number[]): number[] {
  return values.map((value, idx) => {
    if (idx === 0) {
      return 0;
    }
    const prev = values[idx - 1];
    if (!Number.isFinite(prev) || prev <= 0 || value <= 0) {
      return 0;
    }
    return Math.log(value / prev);
  });
}

function rollingMomentum(values: number[], window = 10): number[] {
  return values.map((value, idx) => {
    if (idx < window) {
      return 0;
    }
    const base = values[idx - window];
    return base === 0 ? 0 : (value - base) / base;
  });
}

function rollingStd(values: number[], window = 20): number[] {
  const result: number[] = new Array(values.length).fill(0);
  for (let i = window - 1; i < values.length; i += 1) {
    const slice = values.slice(i - window + 1, i + 1);
    const mean = slice.reduce((acc, value) => acc + value, 0) / slice.length;
    const variance =
      slice.reduce((acc, value) => acc + (value - mean) ** 2, 0) / slice.length;
    result[i] = Number.isFinite(variance) ? Math.sqrt(variance) : 0;
  }
  return result;
}

function rollingMean(values: number[], window = 20): number[] {
  const result: number[] = new Array(values.length).fill(0);
  for (let i = window - 1; i < values.length; i += 1) {
    const slice = values.slice(i - window + 1, i + 1);
    result[i] = slice.reduce((acc, value) => acc + value, 0) / slice.length;
  }
  return result;
}

function rollingSharpe(values: number[], window = 20): number[] {
  const vol = rollingStd(values, window);
  const mean = rollingMean(values, window);
  const sqrtAnnualization = Math.sqrt(252);
  return mean.map((m, idx) => {
    const sigma = vol[idx];
    if (!Number.isFinite(m) || !Number.isFinite(sigma) || sigma === 0) {
      return 0;
    }
    return (m / sigma) * sqrtAnnualization;
  });
}

function computeObv(closes: number[], volumes: number[]): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i] > closes[i - 1]) {
      result[i] = result[i - 1] + volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      result[i] = result[i - 1] - volumes[i];
    } else {
      result[i] = result[i - 1];
    }
  }
  return result;
}

function computeRateOfChange(values: number[], window = 10): number[] {
  return values.map((value, idx) => {
    if (idx < window) {
      return 0;
    }
    const base = values[idx - window];
    return base === 0 ? 0 : (value - base) / base;
  });
}

function computeVwap(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  window = 20,
): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < closes.length; i += 1) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativePV += typicalPrice * volumes[i];
    cumulativeVolume += volumes[i];
    if (i >= window) {
      const prevTypical =
        (highs[i - window] + lows[i - window] + closes[i - window]) / 3;
      cumulativePV -= prevTypical * volumes[i - window];
      cumulativeVolume -= volumes[i - window];
    }
    result[i] =
      cumulativeVolume === 0 ? closes[i] : cumulativePV / cumulativeVolume;
  }

  return result;
}

function computeRsi(values: number[], period = 14): number[] {
  const gains: number[] = [];
  const losses: number[] = [];
  const result: number[] = new Array(values.length).fill(50);

  for (let i = 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    gains.push(Math.max(change, 0));
    losses.push(Math.abs(Math.min(change, 0)));

    if (i >= period) {
      const avgGain =
        gains.slice(-period).reduce((acc, value) => acc + value, 0) / period;
      const avgLoss =
        losses.slice(-period).reduce((acc, value) => acc + value, 0) / period;
      if (avgLoss === 0) {
        result[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        result[i] = 100 - 100 / (1 + rs);
      }
    }
  }

  return result;
}

function computeMacd(
  values: number[],
  config: FeatureEngineeringOptions["macd"] = DEFAULT_OPTIONS.macd,
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const fast = ema(values, config?.fast ?? 12);
  const slow = ema(values, config?.slow ?? 26);
  const macdLine = fast.map((value, idx) => value - slow[idx]);
  const signalLine = ema(macdLine, config?.signal ?? 9);
  const histogram = macdLine.map((value, idx) => value - signalLine[idx]);
  return { macdLine, signalLine, histogram };
}

function ema(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(0);
  const k = 2 / (period + 1);
  let prev = values[0];
  result[0] = prev;
  for (let i = 1; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

function computeBollinger(
  values: number[],
  period = 20,
  stdDev = 2,
): { percentB: number[]; bandwidth: number[] } {
  const mean = rollingMean(values, period);
  const std = rollingStd(values, period);
  const percentB = values.map((value, idx) => {
    const upper = mean[idx] + std[idx] * stdDev;
    const lower = mean[idx] - std[idx] * stdDev;
    if (upper === lower) {
      return 0;
    }
    return (value - lower) / (upper - lower);
  });
  const bandwidth = std.map((value, idx) => {
    const ma = mean[idx];
    return ma === 0 ? 0 : (value * stdDev * 2) / ma;
  });
  return { percentB, bandwidth };
}

function computeDrawdown(values: number[]): number[] {
  const result: number[] = new Array(values.length).fill(0);
  let peak = values[0];
  for (let i = 0; i < values.length; i += 1) {
    peak = Math.max(peak, values[i]);
    result[i] = peak === 0 ? 0 : values[i] / peak - 1;
  }
  return result;
}

function rollingKurtosis(values: number[], window = 21): number[] {
  return values.map((_value, idx) => {
    if (idx < window) {
      return 0;
    }
    const slice = values.slice(idx - window + 1, idx + 1);
    const mean =
      slice.reduce((acc, value) => acc + value, 0) / Math.max(slice.length, 1);
    const centered = slice.map((value) => value - mean);
    const variance =
      centered.reduce((acc, value) => acc + value ** 2, 0) / slice.length;
    if (variance === 0) {
      return 0;
    }
    const fourthMoment =
      centered.reduce((acc, value) => acc + value ** 4, 0) / slice.length;
    return fourthMoment / (variance ** 2);
  });
}

function rollingSkewness(values: number[], window = 21): number[] {
  return values.map((_value, idx) => {
    if (idx < window) {
      return 0;
    }
    const slice = values.slice(idx - window + 1, idx + 1);
    const mean =
      slice.reduce((acc, value) => acc + value, 0) / Math.max(slice.length, 1);
    const centered = slice.map((value) => value - mean);
    const variance =
      centered.reduce((acc, value) => acc + value ** 2, 0) / slice.length;
    const std = Math.sqrt(variance);
    if (std === 0) {
      return 0;
    }
    const thirdMoment =
      centered.reduce((acc, value) => acc + value ** 3, 0) / slice.length;
    return thirdMoment / (std ** 3);
  });
}

function rollingCorrelation(
  a: number[],
  b: number[],
  window = 20,
): number[] {
  const result: number[] = new Array(a.length).fill(0);
  for (let i = window - 1; i < a.length; i += 1) {
    const sliceA = a.slice(i - window + 1, i + 1);
    const sliceB = b.slice(i - window + 1, i + 1);
    const meanA =
      sliceA.reduce((acc, value) => acc + value, 0) / Math.max(sliceA.length, 1);
    const meanB =
      sliceB.reduce((acc, value) => acc + value, 0) / Math.max(sliceB.length, 1);
    let covariance = 0;
    let varianceA = 0;
    let varianceB = 0;
    for (let j = 0; j < sliceA.length; j += 1) {
      const diffA = sliceA[j] - meanA;
      const diffB = sliceB[j] - meanB;
      covariance += diffA * diffB;
      varianceA += diffA ** 2;
      varianceB += diffB ** 2;
    }
    if (varianceA === 0 || varianceB === 0) {
      result[i] = 0;
    } else {
      result[i] = covariance / Math.sqrt(varianceA * varianceB);
    }
  }
  return result;
}

function rollingBeta(
  asset: number[],
  benchmark: number[],
  window = 20,
): number[] {
  const corr = rollingCorrelation(asset, benchmark, window);
  const assetStd = rollingStd(asset, window);
  const benchStd = rollingStd(benchmark, window);
  return corr.map((value, idx) => {
    const denom = benchStd[idx];
    if (denom === 0) {
      return 0;
    }
    return value * (assetStd[idx] / denom);
  });
}

function computeSectorRelativePerformance(
  assetReturns: number[],
  sectorReturns: number[],
  window = 15,
): number[] {
  const sectorRolling = rollingMean(sectorReturns, window);
  return assetReturns.map((value, idx) => safeNumber(value - sectorRolling[idx]));
}

function computeVolumeImbalance(
  volumes: number[],
  returns: number[],
  window = 20,
): number[] {
  const avgVolume = rollingMean(volumes, window).map((value, idx) =>
    value || volumes[idx] || 1,
  );
  return volumes.map((volume, idx) => {
    const direction = Math.sign(returns[idx]);
    return direction * (volume / Math.max(avgVolume[idx], 1));
  });
}

function safeNumber(value: number | null | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 0;
  }
  return value ?? 0;
}
