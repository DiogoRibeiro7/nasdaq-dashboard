"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MultiChartRow = {
  date: string;
  [symbol: string]: string | number;
};

type MultiStockChartProps = {
  data: MultiChartRow[];
  symbols: string[];
};

/**
 * Multi-line comparison chart.
 *
 * Each line represents a stock, with values normalised to 1 at the
 * start of the selected range to make relative performance comparable.
 */
export function MultiStockChart({ data, symbols }: MultiStockChartProps) {
  if (symbols.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
        Select at least one ticker to see the comparison chart.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            minTickGap={20}
          />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend />
          {symbols.map((symbol) => (
            <Line
              key={symbol}
              type="monotone"
              dataKey={symbol}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
