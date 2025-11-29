"use client";

import { useMemo, type JSX } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { ChartPoint } from "@/lib/types";
import type { GapEvent, VolumeSpikeEvent } from "@/lib/stats";
import { shouldShowCurrency } from "@/lib/stocks";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the StockChart component.
 */
export type StockChartProps = {
  /** Array of data points with date and closing price */
  data: ChartPoint[];
  /** Optional symbol to determine currency formatting */
  symbol?: string;
  /** Optional price gap markers */
  gapEvents?: GapEvent[];
  /** Optional volume spike markers */
  volumeEvents?: VolumeSpikeEvent[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Line chart displaying closing prices for a single stock over time.
 *
 * Uses Recharts for rendering with automatic axis scaling and tooltips.
 * The chart is responsive and will fill its container width.
 */
export function StockChart({
  data,
  symbol,
  gapEvents,
  volumeEvents,
}: StockChartProps): JSX.Element {
  const showCurrency = !symbol || shouldShowCurrency(symbol);

  const formatValue = (value: number) =>
    showCurrency ? formatCurrency(value) : formatNumber(value);

  const closeByDate = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((point) => map.set(point.date, point.close));
    return map;
  }, [data]);

  const gapMarkers = useMemo(() => {
    if (!gapEvents) return [];
    return gapEvents
      .map((event) => {
        const close = closeByDate.get(event.date);
        if (close === undefined) return null;
        return { ...event, close };
      })
      .filter((event): event is GapEvent & { close: number } => event !== null);
  }, [gapEvents, closeByDate]);

  const volumeMarkers = useMemo(() => {
    if (!volumeEvents) return [];
    return volumeEvents
      .map((event) => {
        const close = closeByDate.get(event.date);
        if (close === undefined) return null;
        return { ...event, close };
      })
      .filter(
        (
          event,
        ): event is VolumeSpikeEvent & { close: number } => event !== null,
      );
  }, [volumeEvents, closeByDate]);

  const eventLookup = useMemo(() => {
    const map = new Map<
      string,
      { gap?: GapEvent; volume?: VolumeSpikeEvent }
    >();

    gapEvents?.forEach((event) => {
      const existing = map.get(event.date) ?? {};
      map.set(event.date, { ...existing, gap: event });
    });

    volumeEvents?.forEach((event) => {
      const existing = map.get(event.date) ?? {};
      map.set(event.date, { ...existing, volume: event });
    });

    return map;
  }, [gapEvents, volumeEvents]);

  const renderTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>): JSX.Element | null => {
    if (!active || !payload || payload.length === 0 || !label) {
      return null;
    }

    const pricePoint = payload.find((item) => item.dataKey === "close");
    const price = pricePoint?.value;
    const eventsForDay = eventLookup.get(label);

    return (
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/95 p-3 shadow-lg">
        <div className="text-xs text-neutral-400">{label}</div>
        {typeof price === "number" && (
          <div className="mt-1 text-sm font-semibold text-neutral-100">
            {formatValue(price)}
          </div>
        )}
        {eventsForDay?.gap && (
          <div className="mt-2 text-xs font-medium text-orange-300">
            Gap: {formatPercent(eventsForDay.gap.gapPct)}
          </div>
        )}
        {eventsForDay?.volume && (
          <div className="mt-1 text-xs font-medium text-sky-300">
            Volume z-score: {formatNumber(eventsForDay.volume.zScore)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
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
            tickFormatter={formatValue}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#171717",
              border: "1px solid #404040",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "#f5f5f5" }}
            content={renderTooltip}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          {gapMarkers.length > 0 && (
            <Scatter
              data={gapMarkers}
              dataKey="close"
              name="Gap"
              shape="triangle"
              fill="#fb923c"
              r={5}
            />
          )}
          {volumeMarkers.length > 0 && (
            <Scatter
              data={volumeMarkers}
              dataKey="close"
              name="Volume Spike"
              shape="circle"
              fill="#38bdf8"
              r={4}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
