"use client";

import type { JSX } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RollingVolatilityPoint } from "@/lib/stats";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the RollingVolChart component.
 */
export type RollingVolChartProps = {
  /** Array of rolling volatility data points */
  data: RollingVolatilityPoint[];
  /** Window size in days (for display purposes) */
  windowDays: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line chart displaying rolling annualized volatility over time.
 *
 * Shows volatility as a percentage on the Y-axis. Uses amber color
 * to visually distinguish from price/return charts.
 *
 * @example
 * ```tsx
 * <RollingVolChart data={rollingVol21d} windowDays={21} />
 * ```
 */
export function RollingVolChart({
  data,
  windowDays,
}: RollingVolChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
        Insufficient data for {windowDays}-day rolling volatility.
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            minTickGap={30}
            stroke="#525252"
          />
          <YAxis
            domain={[0, "auto"]}
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
            tickFormatter={(value: number) => `${(value * 100).toFixed(0)}%`}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #404040",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#f5f5f5" }}
            formatter={(value: number) => [
              `${(value * 100).toFixed(2)}%`,
              `${windowDays}d Vol`,
            ]}
          />
          <Line
            type="monotone"
            dataKey="vol"
            stroke="#f59e0b"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
