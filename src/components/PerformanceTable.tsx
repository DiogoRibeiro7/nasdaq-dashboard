"use client";

import type { JSX } from "react";
import { useMemo } from "react";
import {
  computeReturns,
  computeSharpeRatio,
  computeCorrelation,
  computeBeta,
  computeSimpleDrawdown
} from "@/lib/stats";
import { formatAxisNumber } from "@/lib/format";

interface PerformanceTableProps {
  stockSymbol: string;
  stockData: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  benchmarkData?: {
    symbol: string;
    name: string;
    data: {
      date: string;
      close: number;
    }[];
  }[];
}

interface PerformanceMetrics {
  symbol: string;
  name: string;
  periods: {
    [key: string]: {
      return: number;
      bestDay: number;
      worstDay: number;
      winRate: number;
      volatility: number;
      sharpe: number;
      maxDrawdown: number;
      correlation?: number;
      beta?: number;
    };
  };
}

const TIME_PERIODS = [
  { key: '1W', label: '1 Week', days: 7 },
  { key: '1M', label: '1 Month', days: 30 },
  { key: '3M', label: '3 Months', days: 90 },
  { key: '6M', label: '6 Months', days: 180 },
  { key: '1Y', label: '1 Year', days: 365 },
  { key: 'YTD', label: 'YTD', days: -1 } // Special case for YTD
];

/**
 * Calculate performance metrics for a given time period
 */
function calculatePeriodMetrics(
  data: { date: string; close: number }[],
  periodDays: number,
  spyData?: { date: string; close: number }[]
): PerformanceMetrics['periods'][string] {
  if (data.length === 0) {
    return {
      return: 0,
      bestDay: 0,
      worstDay: 0,
      winRate: 0,
      volatility: 0,
      sharpe: 0,
      maxDrawdown: 0,
      correlation: undefined,
      beta: undefined
    };
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));

  // Determine the start date based on period
  let startDate: string;
  const latestDate = new Date(sortedData[sortedData.length - 1].date);

  if (periodDays === -1) {
    // YTD: from January 1st of current year
    const year = latestDate.getFullYear();
    startDate = `${year}-01-01`;
  } else {
    // Regular period: go back N days
    const startDateObj = new Date(latestDate);
    startDateObj.setDate(startDateObj.getDate() - periodDays);
    startDate = startDateObj.toISOString().split('T')[0];
  }

  // Filter data for the period
  const periodData = sortedData.filter(d => d.date >= startDate);

  if (periodData.length < 2) {
    return {
      return: 0,
      bestDay: 0,
      worstDay: 0,
      winRate: 0,
      volatility: 0,
      sharpe: 0,
      maxDrawdown: 0,
      correlation: undefined,
      beta: undefined
    };
  }

  // Calculate returns
  const prices = periodData.map(d => d.close);
  const returns = computeReturns(prices);

  // Period return
  const periodReturn = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

  // Best and worst days
  const bestDay = returns.length > 0 ? Math.max(...returns) * 100 : 0;
  const worstDay = returns.length > 0 ? Math.min(...returns) * 100 : 0;

  // Win rate (percentage of positive days)
  const positiveDays = returns.filter(r => r > 0).length;
  const winRate = returns.length > 0 ? (positiveDays / returns.length) * 100 : 0;

  // Volatility (annualized)
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const dailyVolatility = Math.sqrt(variance);
  const annualizedVolatility = dailyVolatility * Math.sqrt(252) * 100;

  // Sharpe ratio (assuming risk-free rate of 0.04 annually)
  const annualizedReturn = avgReturn * 252;
  const riskFreeRate = 0.04;
  const sharpeRatio = dailyVolatility > 0
    ? (annualizedReturn - riskFreeRate) / (dailyVolatility * Math.sqrt(252))
    : 0;

  // Max drawdown
  const drawdowns = computeSimpleDrawdown(prices);
  const maxDrawdown = drawdowns.length > 0
    ? Math.min(...drawdowns.map(d => d.drawdown))
    : 0;

  // Correlation and beta (if SPY data is available)
  let correlation: number | undefined;
  let beta: number | undefined;

  if (spyData && spyData.length > 0) {
    // Filter SPY data for the same period
    const spyPeriodData = spyData.filter(d => d.date >= startDate && d.date <= periodData[periodData.length - 1].date);

    if (spyPeriodData.length >= 2) {
      const spyPrices = spyPeriodData.map(d => d.close);
      const spyReturns = computeReturns(spyPrices);

      // Align returns (use minimum length)
      const minLength = Math.min(returns.length, spyReturns.length);
      const alignedReturns = returns.slice(-minLength);
      const alignedSpyReturns = spyReturns.slice(-minLength);

      if (alignedReturns.length > 1) {
        correlation = computeCorrelation(alignedReturns, alignedSpyReturns);
        beta = computeBeta(alignedReturns, alignedSpyReturns);
      }
    }
  }

  return {
    return: periodReturn,
    bestDay,
    worstDay,
    winRate,
    volatility: annualizedVolatility,
    sharpe: sharpeRatio,
    maxDrawdown: maxDrawdown * 100,
    correlation,
    beta
  };
}

/**
 * Format a performance value with color coding
 */
function PerformanceCell({
  value,
  format = 'percentage',
  benchmark,
  inverse = false
}: {
  value: number | undefined;
  format?: 'percentage' | 'number' | 'ratio';
  benchmark?: number;
  inverse?: boolean;
}): JSX.Element {
  if (value === undefined || isNaN(value)) {
    return <span className="text-neutral-500">—</span>;
  }

  let formattedValue: string;
  if (format === 'percentage') {
    formattedValue = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  } else if (format === 'ratio') {
    formattedValue = value.toFixed(2);
  } else {
    formattedValue = formatAxisNumber(value);
  }

  // Determine color based on benchmark comparison or value sign
  let colorClass = 'text-neutral-300';

  if (benchmark !== undefined) {
    const isOutperforming = inverse ? value < benchmark : value > benchmark;
    colorClass = isOutperforming ? 'text-green-400' : 'text-red-400';
  } else if (format === 'percentage') {
    if (inverse) {
      colorClass = value > 0 ? 'text-red-400' : value < 0 ? 'text-green-400' : 'text-neutral-300';
    } else {
      colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-neutral-300';
    }
  }

  return <span className={colorClass}>{formattedValue}</span>;
}

/**
 * Performance comparison table component
 */
export function PerformanceTable({
  stockSymbol,
  stockData,
  benchmarkData = []
}: PerformanceTableProps): JSX.Element {
  // Add default benchmarks if not provided
  const defaultBenchmarks = useMemo(() => {
    const benchmarks = [...benchmarkData];

    // Ensure we have SPY and QQQ
    if (!benchmarks.find(b => b.symbol === 'SPY')) {
      benchmarks.push({
        symbol: 'SPY',
        name: 'S&P 500',
        data: [] // Will be empty, showing as unavailable
      });
    }

    if (!benchmarks.find(b => b.symbol === 'QQQ')) {
      benchmarks.push({
        symbol: 'QQQ',
        name: 'NASDAQ 100',
        data: []
      });
    }

    return benchmarks;
  }, [benchmarkData]);

  // Calculate metrics for all assets
  const performanceMetrics = useMemo(() => {
    const metrics: PerformanceMetrics[] = [];

    // Convert stock data to the format needed
    const stockPriceData = stockData.map(d => ({
      date: d.date,
      close: d.close
    }));

    // Find SPY data for correlation/beta calculations
    const spyBenchmark = defaultBenchmarks.find(b => b.symbol === 'SPY');
    const spyData = spyBenchmark?.data || [];

    // Calculate stock metrics
    const stockMetrics: PerformanceMetrics = {
      symbol: stockSymbol,
      name: stockSymbol,
      periods: {}
    };

    for (const period of TIME_PERIODS) {
      stockMetrics.periods[period.key] = calculatePeriodMetrics(
        stockPriceData,
        period.days,
        spyData
      );
    }

    metrics.push(stockMetrics);

    // Calculate benchmark metrics
    for (const benchmark of defaultBenchmarks) {
      const benchmarkMetrics: PerformanceMetrics = {
        symbol: benchmark.symbol,
        name: benchmark.name,
        periods: {}
      };

      for (const period of TIME_PERIODS) {
        benchmarkMetrics.periods[period.key] = calculatePeriodMetrics(
          benchmark.data,
          period.days,
          spyData
        );
      }

      metrics.push(benchmarkMetrics);
    }

    return metrics;
  }, [stockSymbol, stockData, defaultBenchmarks]);

  // Get the stock's metrics for comparison
  const stockMetrics = performanceMetrics[0];

  return (
    <div className="w-full">
      {/* Responsive table container with horizontal scroll */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-neutral-700">
              <th className="text-left py-2 px-3 font-medium text-neutral-400">Asset</th>
              {TIME_PERIODS.map(period => (
                <th key={period.key} className="text-right py-2 px-3 font-medium text-neutral-400">
                  {period.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Returns Section */}
            <tr className="border-b border-neutral-800">
              <td colSpan={TIME_PERIODS.length + 1} className="py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Total Return
              </td>
            </tr>
            {performanceMetrics.map((metric, idx) => (
              <tr key={`return-${metric.symbol}`} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <span className={idx === 0 ? 'font-medium text-neutral-100' : 'text-neutral-300'}>
                      {metric.name}
                    </span>
                    {idx === 0 && (
                      <span className="text-xs bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">You</span>
                    )}
                  </div>
                </td>
                {TIME_PERIODS.map(period => (
                  <td key={period.key} className="text-right py-2 px-3">
                    <PerformanceCell
                      value={metric.periods[period.key]?.return}
                      format="percentage"
                      benchmark={idx === 0 ? undefined : stockMetrics.periods[period.key]?.return}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Volatility Section */}
            <tr className="border-b border-neutral-800">
              <td colSpan={TIME_PERIODS.length + 1} className="py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Annualized Volatility
              </td>
            </tr>
            {performanceMetrics.map((metric, idx) => (
              <tr key={`vol-${metric.symbol}`} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3">
                  <span className={idx === 0 ? 'font-medium text-neutral-100' : 'text-neutral-300'}>
                    {metric.name}
                  </span>
                </td>
                {TIME_PERIODS.map(period => (
                  <td key={period.key} className="text-right py-2 px-3">
                    <PerformanceCell
                      value={metric.periods[period.key]?.volatility}
                      format="percentage"
                      inverse={true}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Best Day Section */}
            <tr className="border-b border-neutral-800">
              <td colSpan={TIME_PERIODS.length + 1} className="py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Best Day
              </td>
            </tr>
            {performanceMetrics.map((metric, idx) => (
              <tr key={`best-${metric.symbol}`} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3">
                  <span className={idx === 0 ? 'font-medium text-neutral-100' : 'text-neutral-300'}>
                    {metric.name}
                  </span>
                </td>
                {TIME_PERIODS.map(period => (
                  <td key={period.key} className="text-right py-2 px-3">
                    <PerformanceCell
                      value={metric.periods[period.key]?.bestDay}
                      format="percentage"
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Worst Day Section */}
            <tr className="border-b border-neutral-800">
              <td colSpan={TIME_PERIODS.length + 1} className="py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Worst Day
              </td>
            </tr>
            {performanceMetrics.map((metric, idx) => (
              <tr key={`worst-${metric.symbol}`} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3">
                  <span className={idx === 0 ? 'font-medium text-neutral-100' : 'text-neutral-300'}>
                    {metric.name}
                  </span>
                </td>
                {TIME_PERIODS.map(period => (
                  <td key={period.key} className="text-right py-2 px-3">
                    <PerformanceCell
                      value={metric.periods[period.key]?.worstDay}
                      format="percentage"
                      inverse={true}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Win Rate Section */}
            <tr className="border-b border-neutral-800">
              <td colSpan={TIME_PERIODS.length + 1} className="py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Win Rate (% Positive Days)
              </td>
            </tr>
            {performanceMetrics.map((metric, idx) => (
              <tr key={`winrate-${metric.symbol}`} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3">
                  <span className={idx === 0 ? 'font-medium text-neutral-100' : 'text-neutral-300'}>
                    {metric.name}
                  </span>
                </td>
                {TIME_PERIODS.map(period => (
                  <td key={period.key} className="text-right py-2 px-3">
                    <PerformanceCell
                      value={metric.periods[period.key]?.winRate}
                      format="percentage"
                      benchmark={50}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Max Drawdown Section */}
            <tr className="border-b border-neutral-800">
              <td colSpan={TIME_PERIODS.length + 1} className="py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Max Drawdown
              </td>
            </tr>
            {performanceMetrics.map((metric, idx) => (
              <tr key={`dd-${metric.symbol}`} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3">
                  <span className={idx === 0 ? 'font-medium text-neutral-100' : 'text-neutral-300'}>
                    {metric.name}
                  </span>
                </td>
                {TIME_PERIODS.map(period => (
                  <td key={period.key} className="text-right py-2 px-3">
                    <PerformanceCell
                      value={metric.periods[period.key]?.maxDrawdown}
                      format="percentage"
                      inverse={true}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Sharpe Ratio Section */}
            <tr className="border-b border-neutral-800">
              <td colSpan={TIME_PERIODS.length + 1} className="py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Sharpe Ratio
              </td>
            </tr>
            {performanceMetrics.map((metric, idx) => (
              <tr key={`sharpe-${metric.symbol}`} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                <td className="py-2 px-3">
                  <span className={idx === 0 ? 'font-medium text-neutral-100' : 'text-neutral-300'}>
                    {metric.name}
                  </span>
                </td>
                {TIME_PERIODS.map(period => (
                  <td key={period.key} className="text-right py-2 px-3">
                    <PerformanceCell
                      value={metric.periods[period.key]?.sharpe}
                      format="ratio"
                      benchmark={0}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Correlation to SPY (only for main stock) */}
            {stockMetrics && (
              <>
                <tr className="border-b border-neutral-800">
                  <td colSpan={TIME_PERIODS.length + 1} className="py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Correlation to SPY
                  </td>
                </tr>
                <tr className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                  <td className="py-2 px-3">
                    <span className="font-medium text-neutral-100">{stockSymbol}</span>
                  </td>
                  {TIME_PERIODS.map(period => (
                    <td key={period.key} className="text-right py-2 px-3">
                      <PerformanceCell
                        value={stockMetrics.periods[period.key]?.correlation}
                        format="ratio"
                      />
                    </td>
                  ))}
                </tr>
              </>
            )}

            {/* Beta to Market (only for main stock) */}
            {stockMetrics && (
              <>
                <tr className="border-b border-neutral-800">
                  <td colSpan={TIME_PERIODS.length + 1} className="py-2 px-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Beta to Market
                  </td>
                </tr>
                <tr className="hover:bg-neutral-800/30">
                  <td className="py-2 px-3">
                    <span className="font-medium text-neutral-100">{stockSymbol}</span>
                  </td>
                  {TIME_PERIODS.map(period => (
                    <td key={period.key} className="text-right py-2 px-3">
                      <PerformanceCell
                        value={stockMetrics.periods[period.key]?.beta}
                        format="ratio"
                        benchmark={1}
                      />
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <span className="text-green-400">Green</span>
          <span>Outperformance / Positive</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400">Red</span>
          <span>Underperformance / Negative</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-300">Gray</span>
          <span>Neutral / Data Unavailable</span>
        </div>
      </div>

      {/* Mobile scroll indicator */}
      <div className="mt-2 text-xs text-neutral-500 md:hidden">
        ← Swipe horizontally to see all periods →
      </div>
    </div>
  );
}