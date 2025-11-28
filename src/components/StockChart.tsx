"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = {
  date: string;
  close: number;
};

type StockChartProps = {
  data: ChartPoint[];
};

/**
 * Line chart of closing prices for a single stock.
 */
export function StockChart({ data }: StockChartProps) {
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
          <YAxis
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 10 }}
          />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="close"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
