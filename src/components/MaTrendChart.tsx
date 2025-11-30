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
  Scatter,
  Legend,
  type TooltipProps,
} from "recharts";
import { formatCurrency, formatNumber, formatAxisNumber } from "@/lib/format";
import type { MaTrendPoint, MaCrossover } from "@/lib/stats";

export type MaTrendChartProps = {
  data: MaTrendPoint[];
  shortWindow: number;
  longWindow: number;
  crossovers: MaCrossover[];
};

type MaTrendCrossoverPoint = MaTrendPoint & {
  crossoverType: MaCrossover["type"];
};

export function MaTrendChart({
  data,
  shortWindow,
  longWindow,
  crossovers,
}: MaTrendChartProps): JSX.Element {
  const markers: MaTrendCrossoverPoint[] = crossovers
    .map<MaTrendCrossoverPoint | null>((event) => {
      const point = data.find((item) => item.date === event.date);
      if (!point) return null;
      return { ...point, crossoverType: event.type };
    })
    .filter((value): value is MaTrendCrossoverPoint => value !== null);
  const goldenMarkers = markers.filter(
    (marker) => marker.crossoverType === "golden",
  );
  const deathMarkers = markers.filter(
    (marker) => marker.crossoverType === "death",
  );

  const formatValue = (
    value: number | null | undefined,
    isPrice: boolean = true,
  ): string => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "—";
    }
    return isPrice ? formatCurrency(value) : formatNumber(value);
  };

  const renderTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0 || !label) {
      return null;
    }

    const closePoint = payload.find((item) => item.dataKey === "close");
    const shortMaPoint = payload.find((item) => item.dataKey === "maShort");
    const longMaPoint = payload.find((item) => item.dataKey === "maLong");

    return (
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/95 p-3 shadow-lg">
        <div className="text-xs text-neutral-400">{label}</div>
        <div className="mt-1 text-sm font-semibold text-neutral-100">
          Close: {formatValue(closePoint?.value)}
        </div>
        <div className="mt-1 text-xs text-sky-300">
          {shortWindow}d MA: {formatValue(shortMaPoint?.value)}
        </div>
        <div className="mt-1 text-xs text-orange-300">
          {longWindow}d MA: {formatValue(longMaPoint?.value)}
        </div>
      </div>
    );
  };

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <Legend
            verticalAlign="top"
            height={32}
            wrapperStyle={{ fontSize: 11 }}
            iconSize={10}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            minTickGap={20}
            stroke="#525252"
          />
          <YAxis
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 10, fill: "#a3a3a3" }}
            stroke="#525252"
            tickFormatter={formatAxisNumber}
          />
          <Tooltip content={renderTooltip} />
          <Line
            type="monotone"
            dataKey="close"
            name="Close"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="maShort"
            name={`${shortWindow}d MA`}
            stroke="#38bdf8"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="maLong"
            name={`${longWindow}d MA`}
            stroke="#f97316"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
          {goldenMarkers.length > 0 && (
            <Scatter
              name="Golden cross"
              data={goldenMarkers}
              dataKey="close"
              fill="#22c55e"
              shape="circle"
              legendType="circle"
            />
          )}
          {deathMarkers.length > 0 && (
            <Scatter
              name="Death cross"
              data={deathMarkers}
              dataKey="close"
              fill="#ef4444"
              shape="diamond"
              legendType="diamond"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
