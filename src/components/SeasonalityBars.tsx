"use client";

import type { JSX } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CalendarBucketStats } from "@/lib/stats";
import { formatAxisNumber } from "@/lib/format";

export type SeasonalityBarsProps = {
  title: string;
  buckets: CalendarBucketStats[];
};

export function SeasonalityBars({
  title,
  buckets,
}: SeasonalityBarsProps): JSX.Element {
  if (buckets.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-sm text-neutral-500">
        Not enough observations to compute {title.toLowerCase()} seasonality.
      </div>
    );
  }

  const chartData = buckets.map((bucket) => ({
    ...bucket,
    meanPct: bucket.mean * 100,
    stdPct: bucket.std * 100,
  }));

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
        <p className="text-xs text-neutral-500">
          Mean daily log return by period (bars). Hover for volatility (std).
        </p>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 10, fill: "#a3a3a3" }}
              stroke="#525252"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#a3a3a3" }}
              stroke="#525252"
              tickFormatter={(value: number) => `${formatAxisNumber(value)}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#171717",
                border: "1px solid #404040",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#f5f5f5" }}
              formatter={(value: number, key: string, payload) => {
                if (key === "meanPct") {
                  return [`${formatAxisNumber(value)}%`, "Mean"];
                }
                if (key === "stdPct") {
                  return [`${formatAxisNumber(value)}%`, "Std"];
                }
                if (key === "count") {
                  return [value, "Observations"];
                }
                return value;
              }}
              labelFormatter={(label) => `Period: ${label}`}
              payload={[
                { dataKey: "meanPct" },
                { dataKey: "stdPct" },
                { dataKey: "count" },
              ]}
            />
            <Bar
              dataKey="meanPct"
              fill="#f97316"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
