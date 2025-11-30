"use client";

import type { JSX } from "react";
import type { CrossSectionMetrics } from "@/lib/stats";
import { formatAxisNumber, formatPercent } from "@/lib/format";

export type CrossSectionTableProps = {
  rows: CrossSectionMetrics[];
  sortBy: keyof CrossSectionMetrics;
  sortDir: "asc" | "desc";
  onSortChange: (key: keyof CrossSectionMetrics) => void;
};

const columns: Array<{
  key: keyof CrossSectionMetrics;
  label: string;
  align?: "left" | "right";
  formatter?: (value: number | string | null) => string;
}> = [
  { key: "symbol", label: "Symbol" },
  {
    key: "lastClose",
    label: "Last Close",
    align: "right",
    formatter: (value) =>
      typeof value === "number" ? formatAxisNumber(value) : "—",
  },
  {
    key: "return1M",
    label: "1M Return",
    align: "right",
    formatter: (value) =>
      typeof value === "number" ? formatPercent(value) : "—",
  },
  {
    key: "return3M",
    label: "3M Return",
    align: "right",
    formatter: (value) =>
      typeof value === "number" ? formatPercent(value) : "—",
  },
  {
    key: "volAnnual",
    label: "Vol (Ann.)",
    align: "right",
    formatter: (value) =>
      typeof value === "number" ? formatPercent(value) : "—",
  },
  {
    key: "sharpe",
    label: "Sharpe",
    align: "right",
    formatter: (value) =>
      typeof value === "number" ? formatAxisNumber(value) : "—",
  },
];

export function CrossSectionTable({
  rows,
  sortBy,
  sortDir,
  onSortChange,
}: CrossSectionTableProps): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900/50">
      <table className="min-w-full table-fixed border-collapse text-xs text-neutral-200">
        <thead className="bg-neutral-900/60 text-neutral-400">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-3 py-2 text-left font-medium ${
                  column.align === "right" ? "text-right" : "text-left"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSortChange(column.key)}
                  className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-neutral-400 transition-colors hover:text-neutral-100"
                >
                  {column.label}
                  {sortBy === column.key && (
                    <span aria-hidden="true">
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-t border-neutral-800">
              {columns.map((column) => {
                const rawValue = row[column.key];
                const display =
                  column.formatter?.(rawValue as number | null | string) ??
                  (typeof rawValue === "number"
                    ? formatAxisNumber(rawValue)
                    : typeof rawValue === "string"
                    ? rawValue
                    : "—");
                const alignment =
                  column.align === "right" ? "text-right" : "text-left";

                return (
                  <td
                    key={column.key}
                    className={`px-3 py-2 text-sm font-medium text-neutral-100 ${alignment}`}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
