/**
 * Chart component for displaying multiple rolling correlations on a single plot.
 *
 * Visualizes how correlations between multiple stocks and a reference stock
 * change over time using different colored lines.
 */

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import type { RollingCorrelationPoint } from "../lib/stats";
import { formatAxisNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CorrelationSeries {
  /** Symbol being compared to reference */
  symbol: string;
  /** Array of correlation data points */
  data: RollingCorrelationPoint[];
}

interface MultiRollingCorrelationChartProps {
  /** Array of correlation series for different symbols */
  series: CorrelationSeries[];
  /** Reference symbol that all others are compared against */
  referenceSymbol: string;
  /** Rolling window size in days */
  windowDays: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Color palette for different lines (up to 6 symbols)
const LINE_COLORS = [
  "#60a5fa", // blue
  "#f87171", // red
  "#4ade80", // green
  "#fbbf24", // yellow
  "#a78bfa", // purple
  "#fb923c", // orange
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MultiRollingCorrelationChart displays multiple correlation time series on one chart.
 *
 * Features:
 * - Multiple colored lines for different stock pairs
 * - Y-axis from -1 to 1 (correlation range)
 * - Reference lines at 0, ±0.5 for visual anchor
 * - Interactive legend to show/hide lines
 * - Unified tooltip showing all correlations at a point
 *
 * @param props - Component props
 * @returns React element
 */
export function MultiRollingCorrelationChart({
  series,
  referenceSymbol,
  windowDays,
}: MultiRollingCorrelationChartProps) {
  const mergedData = React.useMemo(() => {
    if (series.length === 0) {
      return [];
    }

    const dataByDate = new Map<string, any>();

    // Collect all unique dates
    for (const { symbol, data } of series) {
      for (const point of data) {
        if (!dataByDate.has(point.date)) {
          dataByDate.set(point.date, { date: point.date });
        }
        dataByDate.get(point.date)[symbol] = point.corr;
      }
    }

    // Convert to array and sort by date
    return Array.from(dataByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [series]);

  // Format correlation value for display
  const formatCorr = (value: number): string => {
    if (typeof value !== "number") return "";
    return formatAxisNumber(value);
  };

  // Format date for axis display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Custom tooltip content showing all series
  const CustomTooltip = ({ active, payload, label: dateLabel }: any) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="text-xs text-muted-foreground mb-2">
            {new Date(dateLabel).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <p className="text-sm">
                <span className="font-medium">{entry.name}:</span> {formatCorr(entry.value)}
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const hasData =
    series.length > 0 && series.some((item) => item.data.length > 0);

  if (!hasData) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No correlation data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={mergedData}
        margin={{ top: 5, right: 5, left: 5, bottom: 25 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.3} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11, fill: "#888" }}
          stroke="#666"
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[-1, 1]}
          ticks={[-1, -0.5, 0, 0.5, 1]}
          tickFormatter={formatCorr}
          tick={{ fontSize: 11, fill: "#888" }}
          stroke="#666"
          label={{
            value: "Correlation",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 11, fill: "#888" }
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="line"
          formatter={(value) => `${value} vs ${referenceSymbol}`}
        />
        <ReferenceLine
          y={0}
          stroke="#888"
          strokeDasharray="3 3"
          strokeWidth={0.5}
        />
        <ReferenceLine
          y={0.5}
          stroke="#888"
          strokeDasharray="1 1"
          strokeWidth={0.3}
        />
        <ReferenceLine
          y={-0.5}
          stroke="#888"
          strokeDasharray="1 1"
          strokeWidth={0.3}
        />
        {series.map(({ symbol }, index) => (
          <Line
            key={symbol}
            type="monotone"
            dataKey={symbol}
            name={symbol}
            stroke={LINE_COLORS[index % LINE_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
