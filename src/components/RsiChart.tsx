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
import type { RsiPoint } from "@/lib/stats";
import { formatAxisNumber } from "@/lib/format";

export type RsiChartProps = {
  data: RsiPoint[];
  period: number;
};

export function RsiChart({
  data,
  period,
}: RsiChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-neutral-500">
        Not enough data for RSI.
      </div>
    );
  }

  const filtered = data.filter((point) => point.rsi !== null);

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={filtered}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            minTickGap={20}
            stroke="#525252"
          />
          <YAxis
            domain={[0, 100]}
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
            formatter={(value: number) => [formatAxisNumber(value), `${period}d RSI`]}
          />
          <ReferenceLine y={70} stroke="#f97316" strokeDasharray="3 3" />
          <ReferenceLine y={30} stroke="#38bdf8" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="rsi"
            stroke="#a855f7"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
