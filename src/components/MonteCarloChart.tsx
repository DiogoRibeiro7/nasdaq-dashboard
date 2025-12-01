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
import type { MonteCarloRunResult } from "@/lib/analytics/scenario";
import { formatAxisNumber } from "@/lib/format";

export type MonteCarloChartProps = {
  result: MonteCarloRunResult | null;
};

export function MonteCarloChart({
  result,
}: MonteCarloChartProps): JSX.Element {
  if (!result || result.paths.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/40 text-sm text-neutral-500">
        Not enough data to simulate paths.
      </div>
    );
  }

  const displayCount = Math.min(20, result.paths.length);
  const displayed = result.paths.slice(0, displayCount);

  const chartData = Array.from(
    { length: result.horizonDays + 1 },
    (_, step) => {
      const row: Record<string, number> = { step };
      displayed.forEach((path, idx) => {
        const point = path.find((p) => p.step === step);
        if (point) {
          row[`path_${idx}`] = point.equity;
        }
      });
      return row;
    },
  );

  return (
    <div className="h-72 w-full rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis
            dataKey="step"
            stroke="#525252"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            label={{
              value: "Days ahead",
              fill: "#a3a3a3",
              fontSize: 12,
              position: "insideBottom",
              offset: -5,
            }}
          />
          <YAxis
            stroke="#525252"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            tickFormatter={formatAxisNumber}
          />
          <Tooltip
            formatter={(value: number) => [formatAxisNumber(value), "Equity"]}
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #404040",
              borderRadius: "8px",
            }}
          />
          {displayed.map((_, idx) => (
            <Line
              key={`path_${idx}`}
              type="monotone"
              dataKey={`path_${idx}`}
              stroke={PATH_COLORS[idx % PATH_COLORS.length]}
              strokeWidth={1.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const PATH_COLORS = [
  "#38bdf8",
  "#f97316",
  "#c084fc",
  "#34d399",
  "#f9a8d4",
  "#facc15",
  "#a78bfa",
  "#fb7185",
  "#67e8f9",
  "#f472b6",
  "#bef264",
  "#f87171",
  "#60a5fa",
  "#fcd34d",
  "#d946ef",
  "#22d3ee",
  "#fde047",
  "#a3e635",
  "#fda4af",
  "#818cf8",
];
