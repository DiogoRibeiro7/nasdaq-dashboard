"use client";

import type { JSX } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MacdPoint } from "@/lib/stats";
import { formatAxisNumber } from "@/lib/format";

export type MacdChartProps = {
  data: MacdPoint[];
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
};

export function MacdChart({
  data,
  fastPeriod,
  slowPeriod,
  signalPeriod,
}: MacdChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
        Not enough data for MACD.
      </div>
    );
  }

  const filtered = data.filter(
    (point) => point.macd !== null || point.signal !== null || point.hist !== null,
  );

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filtered}>
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
            formatter={(value: number, name: string) => [
              formatAxisNumber(value),
              name,
            ]}
          />
          <Legend />
          <Bar
            dataKey="hist"
            name="Histogram"
            fill="#f97316"
            radius={[4, 4, 4, 4]}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="macd"
            name={`MACD (${fastPeriod}, ${slowPeriod})`}
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="signal"
            name={`Signal (${signalPeriod})`}
            stroke="#a855f7"
            strokeWidth={1.5}
            dot={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
