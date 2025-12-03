"use client";

import type { JSX } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint, ForecastModelType } from "@/lib/analytics/forecast";
import { formatAxisNumber } from "@/lib/format";

export type ForecastChartProps = {
  history: { date: string; close: number }[];
  forecast: ForecastPoint[];
  model?: ForecastModelType;
  modelParams?: any;
};

export function ForecastChart({
  history,
  forecast,
  model,
  modelParams,
}: ForecastChartProps): JSX.Element {
  // Show last 60 days of history for better context
  const chartHistory = history.slice(-60);

  // Create history data points
  const historyData = chartHistory.map((point) => ({
    date: point.date,
    actual: point.close,
    forecast: null,
    lower: null,
    upper: null,
    type: "history",
  }));

  // Add connection point (last historical value also as first forecast point for continuity)
  const lastHistoricalPoint = chartHistory[chartHistory.length - 1];
  const connectionPoint = lastHistoricalPoint ? {
    date: lastHistoricalPoint.date,
    actual: lastHistoricalPoint.close,
    forecast: lastHistoricalPoint.close,
    lower: lastHistoricalPoint.close,
    upper: lastHistoricalPoint.close,
    type: "connection",
  } : null;

  // Create forecast data points
  const forecastData = forecast.map((point) => ({
    date: point.date,
    actual: null,
    forecast: point.point,
    lower: point.lower,
    upper: point.upper,
    type: "forecast",
  }));

  // Combine all data points
  const combined = connectionPoint
    ? [...historyData.slice(0, -1), connectionPoint, ...forecastData]
    : [...historyData, ...forecastData];

  if (combined.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
        Not enough data to generate a forecast.
      </div>
    );
  }

  // Calculate min/max for better Y-axis range
  const allValues = combined.flatMap(d => [d.actual, d.forecast, d.lower, d.upper].filter(v => v !== null));
  const minValue = Math.min(...allValues) * 0.95;
  const maxValue = Math.max(...allValues) * 1.05;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={combined} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            minTickGap={30}
            stroke="#525252"
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis
            domain={[minValue, maxValue]}
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
                let modelInfo = `${label} (forecast)`;
                if (model === "arima" && modelParams) {
                  modelInfo += `\nARIMA(1,1,1): AR=${modelParams.arCoefficient?.toFixed(3) || "N/A"}, MA=${modelParams.maCoefficient?.toFixed(3) || "N/A"}`;
                } else if (model === "ewma") {
                  modelInfo += `\nEWMA: λ=0.2`;
                } else if (model === "rolling_mean") {
                  modelInfo += `\nRolling Mean: window=20`;
                } else if (model === "naive") {
                  modelInfo += `\nNaive (Last Value)`;
                }
                return modelInfo;
              }
              return label;
            }}
          />
          {/* Confidence bands - render as a filled area between upper and lower */}
          <Area
            type="monotone"
            dataKey="upper"
            stackId="1"
            stroke="none"
            fill="url(#colorConfidence)"
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stackId="1"
            stroke="none"
            fill="#171717"
            activeDot={false}
            isAnimationActive={false}
          />

          {/* Historical prices */}
          <Line
            type="monotone"
            dataKey="actual"
            name="Historical Price"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />

          {/* Forecast line */}
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={true}
            strokeDasharray="5 3"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
