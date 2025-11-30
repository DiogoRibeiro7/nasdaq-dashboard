"use client";

import type { JSX } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint } from "@/lib/analytics/forecast";
import { formatAxisNumber } from "@/lib/format";

export type ForecastChartProps = {
  history: { date: string; close: number }[];
  forecast: ForecastPoint[];
};

export function ForecastChart({
  history,
  forecast,
}: ForecastChartProps): JSX.Element {
  const chartHistory = history.slice(-120);

  const historyData = chartHistory.map((point) => ({
    date: point.date,
    actual: point.close,
    forecast: null,
    lower: null,
    upper: null,
    type: "history",
  }));

  const forecastData = forecast.map((point) => ({
    date: point.date,
    actual: null,
    forecast: point.point,
    lower: point.lower,
    upper: point.upper,
    type: "forecast",
  }));

  const combined = [...historyData, ...forecastData];

  if (combined.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
        Not enough data to generate a forecast.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={combined}>
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
            formatter={(
              value: number | string | Array<number | string> | null,
              label: string,
            ) => {
              if (typeof value === "number") {
                return [formatAxisNumber(value), label];
              }
              return ["—", label];
            }}
            labelFormatter={(label, payload) => {
              const context = payload?.[0]?.payload;
              if (context?.type === "forecast") {
                return `${label} (forecast)`;
              }
              return label;
            }}
          />
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="rgba(56, 189, 248, 0.2)"
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="rgba(56, 189, 248, 0.2)"
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Historical Close"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#f97316"
            strokeDasharray="4 4"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
