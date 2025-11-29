"use client";

import type { JSX } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DrawdownPoint } from "@/lib/stats";
import { formatAxisNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the DrawdownChart component.
 */
export type DrawdownChartProps = {
  /** Array of drawdown data points */
  data: DrawdownPoint[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Area chart displaying drawdown from peak over time.
 *
 * Shows drawdown as a percentage below zero. Uses red fill to
 * emphasize the underwater periods. Values are always <= 0,
 * with 0 representing a new high.
 *
 * @example
 * ```tsx
 * <DrawdownChart data={drawdownData} />
 * ```
 */
export function DrawdownChart({ data }: DrawdownChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
        No data available for drawdown chart.
      </div>
    );
  }

  // Find min drawdown for Y-axis domain
  const minDrawdown = Math.min(...data.map((d) => d.drawdown));
  const yMin = Math.min(minDrawdown * 1.1, -0.01); // Leave some padding, ensure at least -1%

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            minTickGap={30}
            stroke="#525252"
          />
          <YAxis
            domain={[yMin, 0]}
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
            formatter={(value: number, name: string) => {
              const label = name === "drawdown" ? "Drawdown" : "Max Drawdown";
              return [`${formatAxisNumber(value * 100)}%`, label];
            }}
          />
          <ReferenceLine y={0} stroke="#525252" />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke="#ef4444"
            strokeWidth={1.5}
            fill="url(#drawdownGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
