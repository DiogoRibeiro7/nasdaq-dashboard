"use client";

import type { JSX } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReturnDistributionBin } from "@/lib/stats";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the ReturnHistogram component.
 */
export type ReturnHistogramProps = {
  /** Array of histogram bins with center values and counts */
  data: ReturnDistributionBin[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bar chart displaying the distribution of daily log returns.
 *
 * X-axis shows return values as percentages, Y-axis shows frequency counts.
 * Includes a zero reference line for visual orientation.
 *
 * @example
 * ```tsx
 * <ReturnHistogram data={distributionBins} />
 * ```
 */
export function ReturnHistogram({ data }: ReturnHistogramProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
        Insufficient data for return distribution.
      </div>
    );
  }

  // Transform data to show percentages on X-axis
  const chartData = data.map((bin) => ({
    binCenter: bin.binCenter * 100, // Convert to percentage
    count: bin.count,
  }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barCategoryGap={0}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis
            dataKey="binCenter"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
            tickFormatter={(value: number) => `${value.toFixed(1)}%`}
            minTickGap={25}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #404040",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#f5f5f5" }}
            formatter={(value: number) => [value, "Count"]}
            labelFormatter={(label: number) => `Return: ${label.toFixed(2)}%`}
          />
          <ReferenceLine x={0} stroke="#525252" strokeDasharray="3 3" />
          <Bar
            dataKey="count"
            fill="#8b5cf6"
            fillOpacity={0.8}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
