"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import {
  calculateBollingerBands,
  calculateStochastic,
  calculateATR,
  calculateOBV,
  calculateCMF,
  calculateWilliamsR,
  calculateCCI,
  calculateMFI,
  calculateADX,
  calculateVWAP,
  calculateMACD,
  calculateRSIExtended,
  calculateParabolicSAR,
  interpretBollingerBands,
  interpretRSI,
  interpretStochastic,
  interpretMACD,
  interpretADX,
  interpretMFI,
  getOverallSentiment,
  type SignalInterpretation
} from "@/lib/indicators/technical";
import { formatAxisNumber } from "@/lib/format";

interface TechnicalIndicatorsPanelProps {
  data: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}

interface IndicatorCardProps {
  title: string;
  value: number | string;
  sparklineData?: number[];
  signal?: SignalInterpretation;
  suffix?: string;
  description?: string;
}

/**
 * Mini sparkline component for indicator visualization
 */
function MiniSparkline({ data }: { data: number[] }): JSX.Element {
  const validData = data.filter(v => !isNaN(v));

  if (validData.length < 2) {
    return <div className="h-8 w-full bg-neutral-800/50 rounded" />;
  }

  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;
  const width = 100;
  const height = 32;
  const padding = 2;

  // Take last 30 points for display
  const displayData = validData.slice(-30);
  const points = displayData.map((value, index) => {
    const x = (index / (displayData.length - 1)) * (width - 2 * padding) + padding;
    const y = height - ((value - min) / range) * (height - 2 * padding) - padding;
    return `${x},${y}`;
  }).join(' ');

  const lastValue = displayData[displayData.length - 1];
  const firstValue = displayData[0];
  const isUp = lastValue > firstValue;

  return (
    <svg
      className="w-full h-8"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Individual indicator card component
 */
function IndicatorCard({
  title,
  value,
  sparklineData,
  signal,
  suffix = "",
  description
}: IndicatorCardProps): JSX.Element {
  const formattedValue = typeof value === 'number'
    ? isNaN(value) ? "—" : value.toFixed(2) + suffix
    : value;

  const signalColor = signal?.signal === 'bullish'
    ? 'text-green-400'
    : signal?.signal === 'bearish'
    ? 'text-red-400'
    : 'text-neutral-400';

  const signalBgColor = signal?.signal === 'bullish'
    ? 'bg-green-900/20'
    : signal?.signal === 'bearish'
    ? 'bg-red-900/20'
    : 'bg-neutral-800/20';

  return (
    <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-800 hover:border-neutral-700 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-neutral-300">{title}</h3>
        {signal && (
          <span className={`text-xs px-2 py-1 rounded ${signalBgColor} ${signalColor}`}>
            {signal.strength === 'strong' ? '●●●' : signal.strength === 'moderate' ? '●●' : '●'}
          </span>
        )}
      </div>

      <div className="text-2xl font-bold text-neutral-100 mb-2">
        {formattedValue}
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div className="mb-2">
          <MiniSparkline data={sparklineData} />
        </div>
      )}

      {(signal || description) && (
        <div className="text-xs text-neutral-500">
          {signal?.description || description}
        </div>
      )}
    </div>
  );
}

/**
 * Settings panel for indicator periods
 */
function IndicatorSettings({
  settings,
  onChange
}: {
  settings: Record<string, number>;
  onChange: (key: string, value: number) => void;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm text-neutral-400 hover:text-neutral-200 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Customize Periods
      </button>

      {isOpen && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 bg-neutral-800/50 rounded-lg">
          {Object.entries(settings).map(([key, value]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs text-neutral-400">{key}</span>
              <input
                type="number"
                value={value}
                onChange={(e) => onChange(key, parseInt(e.target.value) || value)}
                className="px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-sm text-neutral-100"
                min="2"
                max="200"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Main Technical Indicators Panel Component
 */
export function TechnicalIndicatorsPanel({
  data
}: TechnicalIndicatorsPanelProps): JSX.Element {
  // Default periods for indicators
  const [periods, setPeriods] = useState({
    'Bollinger': 20,
    'Stochastic': 14,
    'ATR': 14,
    'CMF': 20,
    'Williams %R': 14,
    'CCI': 20,
    'MFI': 14,
    'ADX': 14,
    'MACD Fast': 12,
    'MACD Slow': 26,
    'MACD Signal': 9,
    'RSI': 14
  });

  const handlePeriodChange = (key: string, value: number) => {
    setPeriods(prev => ({ ...prev, [key]: value }));
  };

  // Extract OHLCV data
  const prices = data.map(d => d.close);
  const opens = data.map(d => d.open);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);

  // Calculate all indicators
  const indicators = useMemo(() => {
    // Bollinger Bands
    const bb = calculateBollingerBands(prices, periods['Bollinger']);
    const bbSignal = !isNaN(bb.percentB[bb.percentB.length - 1])
      ? interpretBollingerBands(
          prices[prices.length - 1],
          bb.upper[bb.upper.length - 1],
          bb.middle[bb.middle.length - 1],
          bb.lower[bb.lower.length - 1],
          bb.percentB[bb.percentB.length - 1]
        )
      : undefined;

    // Stochastic
    const stoch = calculateStochastic(highs, lows, prices, periods['Stochastic']);
    const stochSignal = !isNaN(stoch.k[stoch.k.length - 1]) && !isNaN(stoch.d[stoch.d.length - 1])
      ? interpretStochastic(stoch.k[stoch.k.length - 1], stoch.d[stoch.d.length - 1])
      : undefined;

    // ATR
    const atr = calculateATR(highs, lows, prices, periods['ATR']);

    // OBV
    const obv = calculateOBV(prices, volumes);

    // CMF
    const cmf = calculateCMF(highs, lows, prices, volumes, periods['CMF']);

    // Williams %R
    const williamsR = calculateWilliamsR(highs, lows, prices, periods['Williams %R']);

    // CCI
    const cci = calculateCCI(highs, lows, prices, periods['CCI']);

    // MFI
    const mfi = calculateMFI(highs, lows, prices, volumes, periods['MFI']);
    const mfiSignal = !isNaN(mfi[mfi.length - 1])
      ? interpretMFI(mfi[mfi.length - 1])
      : undefined;

    // ADX
    const adx = calculateADX(highs, lows, prices, periods['ADX']);
    const adxSignal = !isNaN(adx.adx[adx.adx.length - 1])
      ? interpretADX(
          adx.adx[adx.adx.length - 1],
          adx.plusDI[adx.plusDI.length - 1],
          adx.minusDI[adx.minusDI.length - 1]
        )
      : undefined;

    // VWAP
    const vwap = calculateVWAP(highs, lows, prices, volumes);

    // MACD
    const macd = calculateMACD(
      prices,
      periods['MACD Fast'],
      periods['MACD Slow'],
      periods['MACD Signal']
    );
    const macdSignal = !isNaN(macd.macd[macd.macd.length - 1]) && !isNaN(macd.signal[macd.signal.length - 1])
      ? interpretMACD(
          macd.macd[macd.macd.length - 1],
          macd.signal[macd.signal.length - 1],
          macd.histogram[macd.histogram.length - 1]
        )
      : undefined;

    // RSI Extended
    const rsi = calculateRSIExtended(prices, periods['RSI']);
    const rsiSignal = !isNaN(rsi.rsi[rsi.rsi.length - 1])
      ? interpretRSI(rsi.rsi[rsi.rsi.length - 1])
      : undefined;

    // Parabolic SAR
    const sar = calculateParabolicSAR(highs, lows);

    return {
      bb,
      bbSignal,
      stoch,
      stochSignal,
      atr,
      obv,
      cmf,
      williamsR,
      cci,
      mfi,
      mfiSignal,
      adx,
      adxSignal,
      vwap,
      macd,
      macdSignal,
      rsi,
      rsiSignal,
      sar
    };
  }, [prices, highs, lows, volumes, periods]);

  // Calculate overall sentiment
  const overallSentiment = useMemo(() => {
    const signals = [
      indicators.bbSignal,
      indicators.stochSignal,
      indicators.mfiSignal,
      indicators.adxSignal,
      indicators.macdSignal,
      indicators.rsiSignal
    ].filter(s => s !== undefined) as SignalInterpretation[];

    return getOverallSentiment(signals);
  }, [indicators]);

  // Get current values
  const currentPrice = prices[prices.length - 1];
  const currentVolume = volumes[volumes.length - 1];

  return (
    <div className="space-y-4">
      {/* Overall Sentiment Bar */}
      <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-neutral-100">Market Sentiment</h3>
          <span className={`text-lg font-bold ${
            overallSentiment.sentiment === 'bullish' ? 'text-green-400' :
            overallSentiment.sentiment === 'bearish' ? 'text-red-400' :
            'text-neutral-400'
          }`}>
            {overallSentiment.description}
          </span>
        </div>

        {/* Sentiment Score Bar */}
        <div className="relative h-8 bg-neutral-800 rounded-full overflow-hidden">
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-gradient-to-r from-red-600 to-red-400 opacity-50" />
            <div className="w-px bg-neutral-600" />
            <div className="flex-1 bg-gradient-to-l from-green-600 to-green-400 opacity-50" />
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded"
            style={{ left: `${(overallSentiment.score + 100) / 2}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-neutral-500">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
      </div>

      {/* Settings */}
      <IndicatorSettings settings={periods} onChange={handlePeriodChange} />

      {/* Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Bollinger Bands */}
        <IndicatorCard
          title="Bollinger Bands %B"
          value={indicators.bb.percentB[indicators.bb.percentB.length - 1]}
          sparklineData={indicators.bb.percentB}
          signal={indicators.bbSignal}
          suffix="%"
        />

        {/* RSI */}
        <IndicatorCard
          title="RSI"
          value={indicators.rsi.rsi[indicators.rsi.rsi.length - 1]}
          sparklineData={indicators.rsi.rsi}
          signal={indicators.rsiSignal}
        />

        {/* Stochastic */}
        <IndicatorCard
          title="Stochastic %K"
          value={indicators.stoch.k[indicators.stoch.k.length - 1]}
          sparklineData={indicators.stoch.k}
          signal={indicators.stochSignal}
        />

        {/* MACD */}
        <IndicatorCard
          title="MACD"
          value={indicators.macd.histogram[indicators.macd.histogram.length - 1]}
          sparklineData={indicators.macd.histogram}
          signal={indicators.macdSignal}
        />

        {/* ATR */}
        <IndicatorCard
          title="ATR"
          value={indicators.atr[indicators.atr.length - 1]}
          sparklineData={indicators.atr}
          description="Market Volatility"
        />

        {/* ADX */}
        <IndicatorCard
          title="ADX"
          value={indicators.adx.adx[indicators.adx.adx.length - 1]}
          sparklineData={indicators.adx.adx}
          signal={indicators.adxSignal}
        />

        {/* MFI */}
        <IndicatorCard
          title="Money Flow Index"
          value={indicators.mfi[indicators.mfi.length - 1]}
          sparklineData={indicators.mfi}
          signal={indicators.mfiSignal}
        />

        {/* Williams %R */}
        <IndicatorCard
          title="Williams %R"
          value={indicators.williamsR[indicators.williamsR.length - 1]}
          sparklineData={indicators.williamsR}
          suffix="%"
          description={
            indicators.williamsR[indicators.williamsR.length - 1] < -80
              ? "Oversold"
              : indicators.williamsR[indicators.williamsR.length - 1] > -20
              ? "Overbought"
              : "Neutral"
          }
        />

        {/* CCI */}
        <IndicatorCard
          title="CCI"
          value={indicators.cci[indicators.cci.length - 1]}
          sparklineData={indicators.cci}
          description={
            indicators.cci[indicators.cci.length - 1] > 100
              ? "Overbought"
              : indicators.cci[indicators.cci.length - 1] < -100
              ? "Oversold"
              : "Neutral"
          }
        />

        {/* CMF */}
        <IndicatorCard
          title="Chaikin Money Flow"
          value={indicators.cmf[indicators.cmf.length - 1]}
          sparklineData={indicators.cmf}
          description={
            indicators.cmf[indicators.cmf.length - 1] > 0
              ? "Buying Pressure"
              : "Selling Pressure"
          }
        />

        {/* OBV */}
        <IndicatorCard
          title="On-Balance Volume"
          value={formatAxisNumber(indicators.obv[indicators.obv.length - 1])}
          sparklineData={indicators.obv}
          description="Volume Momentum"
        />

        {/* VWAP */}
        <IndicatorCard
          title="VWAP"
          value={indicators.vwap[indicators.vwap.length - 1]}
          sparklineData={indicators.vwap}
          suffix=""
          description={
            currentPrice > indicators.vwap[indicators.vwap.length - 1]
              ? "Price above VWAP"
              : "Price below VWAP"
          }
        />

        {/* Parabolic SAR */}
        <IndicatorCard
          title="Parabolic SAR"
          value={indicators.sar[indicators.sar.length - 1]}
          sparklineData={indicators.sar}
          description={
            currentPrice > indicators.sar[indicators.sar.length - 1]
              ? "Uptrend"
              : "Downtrend"
          }
        />

        {/* Stochastic %D */}
        <IndicatorCard
          title="Stochastic %D"
          value={indicators.stoch.d[indicators.stoch.d.length - 1]}
          sparklineData={indicators.stoch.d}
          description="Signal Line"
        />

        {/* ADX +DI/-DI */}
        <IndicatorCard
          title="ADX DI±"
          value={`+${indicators.adx.plusDI[indicators.adx.plusDI.length - 1]?.toFixed(1) || "—"} / -${indicators.adx.minusDI[indicators.adx.minusDI.length - 1]?.toFixed(1) || "—"}`}
          description="Directional Indicators"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-neutral-500 mt-6">
        <div className="flex items-center gap-2">
          <span className="text-green-400">●●●</span>
          <span>Strong Bullish</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-400">●●</span>
          <span>Moderate Bullish</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">●</span>
          <span>Weak/Neutral</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400">●●</span>
          <span>Moderate Bearish</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400">●●●</span>
          <span>Strong Bearish</span>
        </div>
      </div>
    </div>
  );
}