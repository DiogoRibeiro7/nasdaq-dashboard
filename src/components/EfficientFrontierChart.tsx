"use client";

import type { JSX } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { FrontierPoint } from "@/lib/analytics/portfolio_opt";

export type EfficientFrontierChartProps = {
  frontier: FrontierPoint[];
  minVar?: FrontierPoint | null;
  maxSharpe?: FrontierPoint | null;
};

type ChartPoint = {
  x: number;
  y: number;
  label: string;
};

const tooltipFormatter = (value: number): string =>
  `${value.toFixed(2)}%`;

export function EfficientFrontierChart({
  frontier,
  minVar,
  maxSharpe,
}: EfficientFrontierChartProps): JSX.Element {
  if (frontier.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-neutral-500">
        Select at least two tickers with overlapping history to run optimisation.
      </div>
    );
  }

  const baseData: ChartPoint[] = frontier.map((point, idx) => ({
    x: point.volatility * 100,
    y: point.expectedReturn * 100,
    label: `Candidate #${idx + 1}`,
  }));

  const minVarPoint =
    minVar &&
    ({
      x: minVar.volatility * 100,
      y: minVar.expectedReturn * 100,
      label: "Min variance",
    } satisfies ChartPoint);

  const maxSharpePoint =
    maxSharpe &&
    ({
      x: maxSharpe.volatility * 100,
      y: maxSharpe.expectedReturn * 100,
      label: "Max Sharpe",
    } satisfies ChartPoint);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid stroke="#404040" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="Volatility"
            stroke="#525252"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            tickFormatter={tooltipFormatter}
            label={{
              value: "Volatility (annual, %)",
              fill: "#a3a3a3",
              fontSize: 12,
              position: "insideBottom",
              offset: -5,
            }}
            domain={[0, "auto"]}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Expected Return"
            stroke="#525252"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            tickFormatter={tooltipFormatter}
            label={{
              value: "Expected return (annual, %)",
              angle: -90,
              position: "insideLeft",
              fill: "#a3a3a3",
              fontSize: 12,
            }}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<FrontierTooltip />} />
          <Scatter
            name="Frontier"
            data={baseData}
            fill="#38bdf8"
            shape="circle"
            opacity={0.6}
          />
          {minVarPoint && (
            <Scatter
              name="Min variance"
              data={[minVarPoint]}
              fill="#fbbf24"
              shape="diamond"
            />
          )}
          {maxSharpePoint && (
            <Scatter
              name="Max Sharpe"
              data={[maxSharpePoint]}
              fill="#f87171"
              shape="triangle"
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function FrontierTooltip({
  active,
  payload,
}: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload as ChartPoint | undefined;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-xs text-neutral-200">
      <div className="font-semibold text-neutral-100">{point.label}</div>
      <div className="mt-1 text-neutral-400">
        <div>Volatility: {tooltipFormatter(point.x)}</div>
        <div>Expected return: {tooltipFormatter(point.y)}</div>
      </div>
    </div>
  );
}
