"use client";

import type { JSX } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PcaResult } from "@/lib/analytics/pca";
import { formatPercent } from "@/lib/format";

export type PcaExplainedVarianceChartProps = {
  result: PcaResult;
};

export function PcaExplainedVarianceChart({
  result,
}: PcaExplainedVarianceChartProps): JSX.Element {
  const data = result.explainedVariance.map((value, index) => ({
    component: `PC${index + 1}`,
    explained: value * 100,
    cumulative: result.cumulativeExplained[index] * 100,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis
            dataKey="component"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
            tickFormatter={(value: number) => `${formatPercent(value / 100)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #404040",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#f5f5f5" }}
            formatter={(value: number, label: string) => [
              formatPercent(value / 100),
              label === "explained"
                ? "Explained variance"
                : "Cumulative explained",
            ]}
          />
          <Bar dataKey="explained" fill="#38bdf8" />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
