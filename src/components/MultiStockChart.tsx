"use client";

import type { JSX } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MultiChartRow } from "@/lib/types";
import { formatAxisNumber } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Color palette for multi-stock chart lines.
 * Colors are chosen for good contrast on dark backgrounds.
 */
const STOCK_COLORS = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the MultiStockChart component.
 */
export type MultiStockChartProps = {
  /** Array of data rows, each containing a date and normalized values per symbol */
  data: MultiChartRow[];
  /** Array of stock symbols to display (determines which lines are rendered) */
  symbols: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-line comparison chart for comparing relative stock performance.
 *
 * Each line represents a stock, with values normalized to 1 at the start
 * of the selected range. This allows for fair comparison of relative
 * performance regardless of absolute price differences.
 *
 * @example
 * ```tsx
 * <MultiStockChart
 *   data={[
 *     { date: "2024-01-01", AAPL: 1.0, MSFT: 1.0 },
 *     { date: "2024-01-02", AAPL: 1.02, MSFT: 0.99 },
 *   ]}
 *   symbols={["AAPL", "MSFT"]}
 * />
 * ```
 */
export function MultiStockChart({
  data,
  symbols,
}: MultiStockChartProps): JSX.Element {
  if (symbols.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
        Select at least one ticker to see the comparison chart.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            minTickGap={20}
            stroke="#525252"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
            tickFormatter={(value: number) => formatAxisNumber(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #404040",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#f5f5f5" }}
            formatter={(value: number | string, name: string) => [
              formatAxisNumber(Number(value)),
              name,
            ]}
          />
          <Legend />
          {symbols.map((symbol, index) => (
            <Line
              key={symbol}
              type="monotone"
              dataKey={symbol}
              stroke={STOCK_COLORS[index % STOCK_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
