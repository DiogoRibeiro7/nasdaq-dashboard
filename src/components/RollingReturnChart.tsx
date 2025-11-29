"use client";

import type { JSX } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RollingReturnPoint } from "@/lib/stats";
import { formatAxisNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the RollingReturnChart component.
 */
export type RollingReturnChartProps = {
  /** Array of rolling return data points */
  data: RollingReturnPoint[];
  /** Window size in days (for display purposes) */
  windowDays: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line chart displaying rolling simple returns over time.
 *
 * Shows returns as a percentage on the Y-axis. Includes a zero reference
 * line for easy interpretation. Uses cyan color to distinguish from
 * volatility and price charts.
 *
 * @example
 * ```tsx
 * <RollingReturnChart data={rollingRet21d} windowDays={21} />
 * ```
 */
export function RollingReturnChart({
  data,
  windowDays,
}: RollingReturnChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
        Insufficient data for {windowDays}-day rolling returns.
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
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
            tickFormatter={(value: number) => `${formatAxisNumber(value * 100)}%`}
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
              `${formatAxisNumber(value * 100)}%`,
              `${windowDays}d Return`,
            ]}
          />
          <ReferenceLine y={0} stroke="#525252" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="ret"
            stroke="#06b6d4"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
