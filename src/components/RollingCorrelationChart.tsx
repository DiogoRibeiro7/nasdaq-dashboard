/**
 * Chart component for displaying rolling correlation over time.
 *
 * Visualizes how the correlation between two stocks changes over time
 * using a simple line chart.
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
  Label,
} from "recharts";
import type { RollingCorrelationPoint } from "../lib/stats";
import { formatAxisNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RollingCorrelationChartProps {
  /** Array of correlation data points with dates */
  data: RollingCorrelationPoint[];
  /** Label describing the correlation (e.g., "AAPL vs MSFT (63d rolling)") */
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RollingCorrelationChart displays a time series of correlation coefficients.
 *
 * Features:
 * - Line chart showing correlation over time
 * - Y-axis from -1 to 1 (correlation range)
 * - Reference line at 0 for visual anchor
 * - Formatted dates on X-axis
 * - Tooltip with correlation values
 *
 * @param props - Component props
 * @returns React element
 */
export function RollingCorrelationChart({
  data,
  label,
}: RollingCorrelationChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No correlation data available
      </div>
    );
  }

  // Format correlation value for display
  const formatCorr = (value: number): string => formatAxisNumber(value);

  // Format date for axis display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Custom tooltip content
  const CustomTooltip = ({ active, payload, label: dateLabel }: any) => {
    if (active && payload && payload[0]) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="text-xs text-muted-foreground">
            {new Date(dateLabel).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="text-sm font-medium">
            Correlation: {formatCorr(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart
          data={data}
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
          >
            <Label
              value="Correlation"
              angle={-90}
              position="insideLeft"
              style={{ fontSize: 11, fill: "#888" }}
            />
          </YAxis>
          <Tooltip content={<CustomTooltip />} />
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
          <Line
            type="monotone"
            dataKey="corr"
            stroke="#60a5fa"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: "#60a5fa" }}
            name="Correlation"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
