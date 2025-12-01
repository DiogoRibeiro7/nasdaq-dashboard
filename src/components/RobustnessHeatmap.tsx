"use client";

import type { JSX } from "react";
import type {
  RobustnessMetric,
  RobustnessSurfacePoint,
} from "@/lib/analytics/robustness";
import { formatPercent, formatAxisNumber } from "@/lib/format";

export type RobustnessHeatmapProps = {
  points: RobustnessSurfacePoint[];
  metric: RobustnessMetric;
  xLabel: string;
  yLabel: string;
};

export function RobustnessHeatmap({
  points,
  metric,
  xLabel,
  yLabel,
}: RobustnessHeatmapProps): JSX.Element {
  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
        Not enough data to build a parameter surface.
      </div>
    );
  }

  const xValues = Array.from(new Set(points.map((point) => point.x))).sort(
    (a, b) => a - b,
  );
  const yValues = Array.from(new Set(points.map((point) => point.y))).sort(
    (a, b) => a - b,
  );

  const dataMap = new Map<string, RobustnessSurfacePoint["metrics"]>();
  for (const point of points) {
    dataMap.set(`${point.x}-${point.y}`, point.metrics);
  }

  const metricValues = points
    .map((point) => point.metrics[metric])
    .filter((value): value is number =>
      typeof value === "number" && Number.isFinite(value),
    );

  const minValue =
    metricValues.length > 0 ? Math.min(...metricValues) : 0;
  const maxValue =
    metricValues.length > 0 ? Math.max(...metricValues) : 0;

  const formatValue = (value: number | null): string => {
    if (value === null) return "—";
    if (metric === "maxDrawdown") {
      return formatPercent(value);
    }
    if (metric === "sharpe") {
      return formatAxisNumber(value);
    }
    return formatPercent(value);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_1fr] gap-2 text-xs text-neutral-400">
        <div className="flex items-center justify-center rotate-180 origin-center -translate-y-1/2 text-[10px]">
          <span style={{ writingMode: "vertical-rl" }}>{yLabel}</span>
        </div>
        <div className="overflow-x-auto">
          <div
            className="inline-grid"
            style={{
              gridTemplateColumns: `repeat(${xValues.length}, minmax(2.5rem, 1fr))`,
              gridTemplateRows: `repeat(${yValues.length}, minmax(2.5rem, 1fr))`,
            }}
          >
            {yValues.map((y) =>
              xValues.map((x) => {
                const metrics = dataMap.get(`${x}-${y}`);
                const value = metrics?.[metric] ?? null;
                const intensity = normalizeValue(value, minValue, maxValue);
                const color =
                  value === null ? "#1f2937" : getColor(metric, intensity);
                return (
                  <div
                    key={`${x}-${y}`}
                    className="flex items-center justify-center border border-neutral-800 text-[10px] font-medium text-neutral-100 transition-transform hover:scale-[1.03]"
                    style={{
                      backgroundColor: color,
                    }}
                    title={`${xLabel} = ${x} | ${yLabel} = ${y} | ${formatValue(value)}`}
                  >
                    {value !== null ? formatValue(value) : "—"}
                  </div>
                );
              }),
            )}
          </div>
          <div className="mt-2 flex justify-center text-xs text-neutral-400">
            {xLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeValue(
  value: number | null,
  minValue: number,
  maxValue: number,
): number {
  if (value === null || !Number.isFinite(value) || maxValue === minValue) {
    return 0.5;
  }
  return (value - minValue) / (maxValue - minValue);
}

function getColor(metric: RobustnessMetric, intensity: number): string {
  if (metric === "maxDrawdown") {
    const red = Math.round(200 + 55 * intensity);
    return `rgb(${red}, 64, 64)`;
  }
  const green = Math.round(100 + 155 * intensity);
  return `rgb(60, ${green}, 110)`;
}
