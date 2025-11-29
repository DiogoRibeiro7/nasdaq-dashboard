"use client";

import type { JSX } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  Legend,
} from "recharts";
import type { BacktestResult } from "@/lib/stats";
import { formatAxisNumber, formatPercent } from "@/lib/format";

export type EquityCurveChartProps = {
  result: BacktestResult;
};

export function EquityCurveChart({
  result,
}: EquityCurveChartProps): JSX.Element {
  if (result.equityCurve.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
        Backtest requires at least one data point.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={result.equityCurve}>
          <defs>
            <linearGradient id="drawdownArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            minTickGap={20}
            stroke="#525252"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
            tickFormatter={(value: number) => formatAxisNumber(value)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
            tickFormatter={(value: number) => formatPercent(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #404040",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#f5f5f5" }}
            formatter={(value: number, name: string) =>
              name === "Drawdown"
                ? [formatPercent(value), name]
                : [formatAxisNumber(value), name]
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="equity"
            name="Equity"
            yAxisId="left"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="drawdown"
            name="Drawdown"
            yAxisId="right"
            stroke="#ef4444"
            fill="url(#drawdownArea)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
