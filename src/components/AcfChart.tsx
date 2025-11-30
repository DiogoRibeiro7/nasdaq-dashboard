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
import type { AcfPoint } from "@/lib/stats";
import { formatAxisNumber } from "@/lib/format";

export type AcfChartProps = {
  acf: AcfPoint[];
  title?: string;
  sampleSize?: number;
};

export function AcfChart({
  acf,
  title,
  sampleSize,
}: AcfChartProps): JSX.Element {
  if (acf.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
        Not enough data to compute autocorrelation.
      </div>
    );
  }

  const confLevel =
    sampleSize && sampleSize > 0
      ? 1.96 / Math.sqrt(sampleSize)
      : 1.96 / Math.sqrt(Math.max(acf.length, 1));

  return (
    <div className="h-48 w-full">
      {title && (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={acf}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis
            dataKey="lag"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
            interval={0}
          />
          <YAxis
            domain={[-1, 1]}
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #404040",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#f5f5f5" }}
            formatter={(value: number) => [formatAxisNumber(value), "ACF"]}
            labelFormatter={(label: number) => `Lag ${label}`}
          />
          <ReferenceLine y={0} stroke="#71717a" strokeDasharray="4 4" />
          <ReferenceLine
            y={confLevel}
            stroke="#94a3b8"
            strokeDasharray="2 2"
          />
          <ReferenceLine
            y={-confLevel}
            stroke="#94a3b8"
            strokeDasharray="2 2"
          />
          <Bar dataKey="value" fill="#22c55e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
