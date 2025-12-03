/**
 * Technical Indicators Library
 * Comprehensive collection of technical analysis indicators
 */

/**
 * Helper function to calculate Simple Moving Average
 */
function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Helper function to calculate Exponential Moving Average
 */
function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA for the first period
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sum += values[i];
      result.push(NaN);
    } else if (i === period - 1) {
      sum += values[i];
      result.push(sum / period);
    } else {
      const prev = result[i - 1];
      result.push((values[i] - prev) * multiplier + prev);
    }
  }
  return result;
}

/**
 * Helper function to calculate standard deviation
 */
function standardDeviation(values: number[], period: number): number[] {
  const means = sma(values, period);
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      const mean = means[i];
      const squaredDiffs = slice.map(v => Math.pow(v - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      result.push(Math.sqrt(avgSquaredDiff));
    }
  }
  return result;
}

/**
 * Calculate Bollinger Bands
 * Upper Band = SMA + (StdDev × Multiplier)
 * Lower Band = SMA - (StdDev × Multiplier)
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): {
  upper: number[],
  middle: number[],
  lower: number[],
  percentB: number[]
} {
  const middle = sma(prices, period);
  const stdDevValues = standardDeviation(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const percentB: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (isNaN(middle[i]) || isNaN(stdDevValues[i])) {
      upper.push(NaN);
      lower.push(NaN);
      percentB.push(NaN);
    } else {
      const upperBand = middle[i] + stdDev * stdDevValues[i];
      const lowerBand = middle[i] - stdDev * stdDevValues[i];
      upper.push(upperBand);
      lower.push(lowerBand);

      // %B = (Price - Lower Band) / (Upper Band - Lower Band)
      const bandwidth = upperBand - lowerBand;
      percentB.push(bandwidth > 0 ? (prices[i] - lowerBand) / bandwidth : 0.5);
    }
  }

  return { upper, middle, lower, percentB };
}

/**
 * Calculate Stochastic Oscillator
 * %K = (Current Close - Lowest Low) / (Highest High - Lowest Low) × 100
 * %D = 3-period SMA of %K
 */
export function calculateStochastic(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): {
  k: number[],
  d: number[]
} {
  const kRaw: number[] = [];

  // Calculate raw %K
  for (let i = 0; i < close.length; i++) {
    if (i < period - 1) {
      kRaw.push(NaN);
    } else {
      const highSlice = high.slice(i - period + 1, i + 1);
      const lowSlice = low.slice(i - period + 1, i + 1);
      const highestHigh = Math.max(...highSlice);
      const lowestLow = Math.min(...lowSlice);
      const range = highestHigh - lowestLow;

      if (range > 0) {
        kRaw.push(((close[i] - lowestLow) / range) * 100);
      } else {
        kRaw.push(50); // Default to middle when range is 0
      }
    }
  }

  // Smooth %K
  const k = sma(kRaw, smoothK);

  // Calculate %D as SMA of %K
  const d = sma(k, smoothD);

  return { k, d };
}

/**
 * Calculate Average True Range (ATR)
 * Measures market volatility
 */
export function calculateATR(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): number[] {
  const trueRanges: number[] = [];

  for (let i = 0; i < high.length; i++) {
    if (i === 0) {
      trueRanges.push(high[i] - low[i]);
    } else {
      const highLow = high[i] - low[i];
      const highPrevClose = Math.abs(high[i] - close[i - 1]);
      const lowPrevClose = Math.abs(low[i] - close[i - 1]);
      trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
    }
  }

  // Use EMA for ATR (Wilder's smoothing)
  return ema(trueRanges, period);
}

/**
 * Calculate On-Balance Volume (OBV)
 * Momentum indicator that uses volume flow
 */
export function calculateOBV(
  close: number[],
  volume: number[]
): number[] {
  const obv: number[] = [];

  for (let i = 0; i < close.length; i++) {
    if (i === 0) {
      obv.push(volume[i]);
    } else {
      const prevOBV = obv[i - 1];
      if (close[i] > close[i - 1]) {
        obv.push(prevOBV + volume[i]);
      } else if (close[i] < close[i - 1]) {
        obv.push(prevOBV - volume[i]);
      } else {
        obv.push(prevOBV);
      }
    }
  }

  return obv;
}

/**
 * Calculate Chaikin Money Flow (CMF)
 * Measures buying and selling pressure
 */
export function calculateCMF(
  high: number[],
  low: number[],
  close: number[],
  volume: number[],
  period: number = 20
): number[] {
  const cmf: number[] = [];
  const moneyFlowVolume: number[] = [];

  // Calculate Money Flow Multiplier and Money Flow Volume
  for (let i = 0; i < close.length; i++) {
    const range = high[i] - low[i];
    let multiplier = 0;

    if (range > 0) {
      multiplier = ((close[i] - low[i]) - (high[i] - close[i])) / range;
    }

    moneyFlowVolume.push(multiplier * volume[i]);
  }

  // Calculate CMF
  for (let i = 0; i < close.length; i++) {
    if (i < period - 1) {
      cmf.push(NaN);
    } else {
      const sumMFV = moneyFlowVolume.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      const sumVolume = volume.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);

      if (sumVolume > 0) {
        cmf.push(sumMFV / sumVolume);
      } else {
        cmf.push(0);
      }
    }
  }

  return cmf;
}

/**
 * Calculate Williams %R
 * Momentum indicator showing overbought/oversold levels
 */
export function calculateWilliamsR(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): number[] {
  const williamsR: number[] = [];

  for (let i = 0; i < close.length; i++) {
    if (i < period - 1) {
      williamsR.push(NaN);
    } else {
      const highSlice = high.slice(i - period + 1, i + 1);
      const lowSlice = low.slice(i - period + 1, i + 1);
      const highestHigh = Math.max(...highSlice);
      const lowestLow = Math.min(...lowSlice);
      const range = highestHigh - lowestLow;

      if (range > 0) {
        williamsR.push(((highestHigh - close[i]) / range) * -100);
      } else {
        williamsR.push(-50); // Default to middle
      }
    }
  }

  return williamsR;
}

/**
 * Calculate Commodity Channel Index (CCI)
 * Identifies cyclical trends
 */
export function calculateCCI(
  high: number[],
  low: number[],
  close: number[],
  period: number = 20
): number[] {
  const cci: number[] = [];
  const typicalPrices: number[] = [];

  // Calculate Typical Price
  for (let i = 0; i < close.length; i++) {
    typicalPrices.push((high[i] + low[i] + close[i]) / 3);
  }

  const tpSMA = sma(typicalPrices, period);

  for (let i = 0; i < close.length; i++) {
    if (i < period - 1) {
      cci.push(NaN);
    } else {
      const tp = typicalPrices[i];
      const ma = tpSMA[i];
      const slice = typicalPrices.slice(i - period + 1, i + 1);

      // Calculate Mean Deviation
      let sumDeviation = 0;
      for (const price of slice) {
        sumDeviation += Math.abs(price - ma);
      }
      const meanDeviation = sumDeviation / period;

      if (meanDeviation > 0) {
        cci.push((tp - ma) / (0.015 * meanDeviation));
      } else {
        cci.push(0);
      }
    }
  }

  return cci;
}

/**
 * Calculate Money Flow Index (MFI)
 * Volume-weighted RSI
 */
export function calculateMFI(
  high: number[],
  low: number[],
  close: number[],
  volume: number[],
  period: number = 14
): number[] {
  const mfi: number[] = [];
  const typicalPrices: number[] = [];
  const rawMoneyFlow: number[] = [];

  // Calculate Typical Price and Raw Money Flow
  for (let i = 0; i < close.length; i++) {
    const tp = (high[i] + low[i] + close[i]) / 3;
    typicalPrices.push(tp);
    rawMoneyFlow.push(tp * volume[i]);
  }

  for (let i = 0; i < close.length; i++) {
    if (i < period) {
      mfi.push(NaN);
    } else {
      let positiveFlow = 0;
      let negativeFlow = 0;

      for (let j = i - period + 1; j <= i; j++) {
        if (j === 0) continue;

        if (typicalPrices[j] > typicalPrices[j - 1]) {
          positiveFlow += rawMoneyFlow[j];
        } else if (typicalPrices[j] < typicalPrices[j - 1]) {
          negativeFlow += rawMoneyFlow[j];
        }
      }

      if (negativeFlow === 0) {
        mfi.push(100);
      } else {
        const moneyRatio = positiveFlow / negativeFlow;
        mfi.push(100 - (100 / (1 + moneyRatio)));
      }
    }
  }

  return mfi;
}

/**
 * Calculate Average Directional Index (ADX)
 * Measures trend strength regardless of direction
 */
export function calculateADX(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): {
  adx: number[],
  plusDI: number[],
  minusDI: number[]
} {
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  // Calculate Directional Movement and True Range
  for (let i = 0; i < high.length; i++) {
    if (i === 0) {
      plusDM.push(0);
      minusDM.push(0);
      tr.push(high[i] - low[i]);
    } else {
      const upMove = high[i] - high[i - 1];
      const downMove = low[i - 1] - low[i];

      if (upMove > downMove && upMove > 0) {
        plusDM.push(upMove);
      } else {
        plusDM.push(0);
      }

      if (downMove > upMove && downMove > 0) {
        minusDM.push(downMove);
      } else {
        minusDM.push(0);
      }

      const highLow = high[i] - low[i];
      const highPrevClose = Math.abs(high[i] - close[i - 1]);
      const lowPrevClose = Math.abs(low[i] - close[i - 1]);
      tr.push(Math.max(highLow, highPrevClose, lowPrevClose));
    }
  }

  // Smooth the values
  const smoothedPlusDM = ema(plusDM, period);
  const smoothedMinusDM = ema(minusDM, period);
  const atr = ema(tr, period);

  // Calculate Directional Indicators
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < high.length; i++) {
    if (isNaN(atr[i]) || atr[i] === 0) {
      plusDI.push(NaN);
      minusDI.push(NaN);
      dx.push(NaN);
    } else {
      const pdi = (smoothedPlusDM[i] / atr[i]) * 100;
      const mdi = (smoothedMinusDM[i] / atr[i]) * 100;
      plusDI.push(pdi);
      minusDI.push(mdi);

      const sum = pdi + mdi;
      if (sum > 0) {
        dx.push((Math.abs(pdi - mdi) / sum) * 100);
      } else {
        dx.push(0);
      }
    }
  }

  // Calculate ADX as smoothed DX
  const adx = ema(dx, period);

  return { adx, plusDI, minusDI };
}

/**
 * Calculate Volume Weighted Average Price (VWAP)
 * Average price weighted by volume
 */
export function calculateVWAP(
  high: number[],
  low: number[],
  close: number[],
  volume: number[]
): number[] {
  const vwap: number[] = [];
  let cumulativeTpv = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < close.length; i++) {
    const typicalPrice = (high[i] + low[i] + close[i]) / 3;
    const tpv = typicalPrice * volume[i];

    cumulativeTpv += tpv;
    cumulativeVolume += volume[i];

    if (cumulativeVolume > 0) {
      vwap.push(cumulativeTpv / cumulativeVolume);
    } else {
      vwap.push(typicalPrice);
    }
  }

  return vwap;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: number[],
  signal: number[],
  histogram: number[]
} {
  const fastEMA = ema(prices, fastPeriod);
  const slowEMA = ema(prices, slowPeriod);
  const macd: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      macd.push(NaN);
    } else {
      macd.push(fastEMA[i] - slowEMA[i]);
    }
  }

  const signal = ema(macd, signalPeriod);
  const histogram: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (isNaN(macd[i]) || isNaN(signal[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macd[i] - signal[i]);
    }
  }

  return { macd, signal, histogram };
}

/**
 * Calculate RSI with additional features
 */
export function calculateRSIExtended(
  prices: number[],
  period: number = 14
): {
  rsi: number[],
  divergence: string[]
} {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      gains.push(0);
      losses.push(0);
      rsi.push(NaN);
    } else {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
  }

  // Calculate RSI
  const avgGains = ema(gains, period);
  const avgLosses = ema(losses, period);

  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      rsi.push(NaN);
    } else {
      if (avgLosses[i] === 0) {
        rsi.push(100);
      } else {
        const rs = avgGains[i] / avgLosses[i];
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
  }

  // Detect divergences
  const divergence: string[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period + 5) {
      divergence.push('none');
    } else {
      // Simple divergence detection
      const priceTrend = prices[i] > prices[i - 5] ? 'up' : 'down';
      const rsiTrend = rsi[i] > rsi[i - 5] ? 'up' : 'down';

      if (priceTrend === 'up' && rsiTrend === 'down') {
        divergence.push('bearish');
      } else if (priceTrend === 'down' && rsiTrend === 'up') {
        divergence.push('bullish');
      } else {
        divergence.push('none');
      }
    }
  }

  return { rsi, divergence };
}

/**
 * Calculate Parabolic SAR
 */
export function calculateParabolicSAR(
  high: number[],
  low: number[],
  accelerationStart: number = 0.02,
  accelerationMax: number = 0.2
): number[] {
  const sar: number[] = [];
  let isUpTrend = true;
  let af = accelerationStart;
  let ep = high[0]; // Extreme Point
  let sarValue = low[0];

  for (let i = 0; i < high.length; i++) {
    if (i === 0) {
      sar.push(sarValue);
      continue;
    }

    // Calculate new SAR
    let newSar = sarValue + af * (ep - sarValue);

    if (isUpTrend) {
      // Ensure SAR is below price in uptrend
      newSar = Math.min(newSar, low[i - 1]);
      if (i > 1) {
        newSar = Math.min(newSar, low[i - 2]);
      }

      if (low[i] <= newSar) {
        // Reverse to downtrend
        isUpTrend = false;
        newSar = ep;
        ep = low[i];
        af = accelerationStart;
      } else {
        // Continue uptrend
        if (high[i] > ep) {
          ep = high[i];
          af = Math.min(af + accelerationStart, accelerationMax);
        }
      }
    } else {
      // Ensure SAR is above price in downtrend
      newSar = Math.max(newSar, high[i - 1]);
      if (i > 1) {
        newSar = Math.max(newSar, high[i - 2]);
      }

      if (high[i] >= newSar) {
        // Reverse to uptrend
        isUpTrend = true;
        newSar = ep;
        ep = high[i];
        af = accelerationStart;
      } else {
        // Continue downtrend
        if (low[i] < ep) {
          ep = low[i];
          af = Math.min(af + accelerationStart, accelerationMax);
        }
      }
    }

    sarValue = newSar;
    sar.push(sarValue);
  }

  return sar;
}

/**
 * Signal interpretation for technical indicators
 */
export interface SignalInterpretation {
  signal: 'bullish' | 'bearish' | 'neutral';
  strength: 'strong' | 'moderate' | 'weak';
  description: string;
}

/**
 * Interpret Bollinger Bands signal
 */
export function interpretBollingerBands(
  price: number,
  upper: number,
  middle: number,
  lower: number,
  percentB: number
): SignalInterpretation {
  if (percentB > 1) {
    return {
      signal: 'bearish',
      strength: 'strong',
      description: 'Price above upper band - Overbought'
    };
  } else if (percentB < 0) {
    return {
      signal: 'bullish',
      strength: 'strong',
      description: 'Price below lower band - Oversold'
    };
  } else if (percentB > 0.8) {
    return {
      signal: 'bearish',
      strength: 'moderate',
      description: 'Price near upper band'
    };
  } else if (percentB < 0.2) {
    return {
      signal: 'bullish',
      strength: 'moderate',
      description: 'Price near lower band'
    };
  } else {
    return {
      signal: 'neutral',
      strength: 'weak',
      description: 'Price within bands'
    };
  }
}

/**
 * Interpret RSI signal
 */
export function interpretRSI(rsi: number): SignalInterpretation {
  if (rsi > 70) {
    return {
      signal: 'bearish',
      strength: rsi > 80 ? 'strong' : 'moderate',
      description: `RSI ${rsi.toFixed(1)} - Overbought`
    };
  } else if (rsi < 30) {
    return {
      signal: 'bullish',
      strength: rsi < 20 ? 'strong' : 'moderate',
      description: `RSI ${rsi.toFixed(1)} - Oversold`
    };
  } else {
    return {
      signal: 'neutral',
      strength: 'weak',
      description: `RSI ${rsi.toFixed(1)} - Neutral`
    };
  }
}

/**
 * Interpret Stochastic signal
 */
export function interpretStochastic(k: number, d: number): SignalInterpretation {
  if (k > 80 && d > 80) {
    return {
      signal: 'bearish',
      strength: 'strong',
      description: 'Overbought zone'
    };
  } else if (k < 20 && d < 20) {
    return {
      signal: 'bullish',
      strength: 'strong',
      description: 'Oversold zone'
    };
  } else if (k > d && k < 50) {
    return {
      signal: 'bullish',
      strength: 'moderate',
      description: 'Bullish crossover'
    };
  } else if (k < d && k > 50) {
    return {
      signal: 'bearish',
      strength: 'moderate',
      description: 'Bearish crossover'
    };
  } else {
    return {
      signal: 'neutral',
      strength: 'weak',
      description: 'Neutral zone'
    };
  }
}

/**
 * Interpret MACD signal
 */
export function interpretMACD(macd: number, signal: number, histogram: number): SignalInterpretation {
  if (histogram > 0 && macd > 0) {
    return {
      signal: 'bullish',
      strength: Math.abs(histogram) > Math.abs(macd * 0.1) ? 'strong' : 'moderate',
      description: 'MACD above signal and zero'
    };
  } else if (histogram < 0 && macd < 0) {
    return {
      signal: 'bearish',
      strength: Math.abs(histogram) > Math.abs(macd * 0.1) ? 'strong' : 'moderate',
      description: 'MACD below signal and zero'
    };
  } else if (histogram > 0) {
    return {
      signal: 'bullish',
      strength: 'weak',
      description: 'MACD above signal'
    };
  } else if (histogram < 0) {
    return {
      signal: 'bearish',
      strength: 'weak',
      description: 'MACD below signal'
    };
  } else {
    return {
      signal: 'neutral',
      strength: 'weak',
      description: 'MACD at equilibrium'
    };
  }
}

/**
 * Interpret ADX signal
 */
export function interpretADX(adx: number, plusDI: number, minusDI: number): SignalInterpretation {
  const trendStrength = adx > 50 ? 'strong' : adx > 25 ? 'moderate' : 'weak';

  if (adx < 25) {
    return {
      signal: 'neutral',
      strength: 'weak',
      description: 'No clear trend'
    };
  } else if (plusDI > minusDI) {
    return {
      signal: 'bullish',
      strength: trendStrength,
      description: `Uptrend (ADX: ${adx.toFixed(1)})`
    };
  } else {
    return {
      signal: 'bearish',
      strength: trendStrength,
      description: `Downtrend (ADX: ${adx.toFixed(1)})`
    };
  }
}

/**
 * Interpret MFI signal
 */
export function interpretMFI(mfi: number): SignalInterpretation {
  if (mfi > 80) {
    return {
      signal: 'bearish',
      strength: mfi > 90 ? 'strong' : 'moderate',
      description: `MFI ${mfi.toFixed(1)} - Overbought`
    };
  } else if (mfi < 20) {
    return {
      signal: 'bullish',
      strength: mfi < 10 ? 'strong' : 'moderate',
      description: `MFI ${mfi.toFixed(1)} - Oversold`
    };
  } else {
    return {
      signal: 'neutral',
      strength: 'weak',
      description: `MFI ${mfi.toFixed(1)} - Neutral`
    };
  }
}

/**
 * Get overall market sentiment from multiple indicators
 */
export function getOverallSentiment(signals: SignalInterpretation[]): {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number;
  description: string;
} {
  let bullishScore = 0;
  let bearishScore = 0;

  for (const signal of signals) {
    const weight = signal.strength === 'strong' ? 3 : signal.strength === 'moderate' ? 2 : 1;

    if (signal.signal === 'bullish') {
      bullishScore += weight;
    } else if (signal.signal === 'bearish') {
      bearishScore += weight;
    }
  }

  const totalScore = bullishScore + bearishScore;
  const sentimentScore = totalScore > 0 ? (bullishScore - bearishScore) / totalScore * 100 : 0;

  let sentiment: 'bullish' | 'bearish' | 'neutral';
  let description: string;

  if (sentimentScore > 30) {
    sentiment = 'bullish';
    description = sentimentScore > 60 ? 'Strongly Bullish' : 'Moderately Bullish';
  } else if (sentimentScore < -30) {
    sentiment = 'bearish';
    description = sentimentScore < -60 ? 'Strongly Bearish' : 'Moderately Bearish';
  } else {
    sentiment = 'neutral';
    description = 'Mixed Signals';
  }

  return {
    sentiment,
    score: sentimentScore,
    description
  };
}