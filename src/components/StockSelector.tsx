"use client";

import type { JSX } from "react";
import { NASDAQ_STOCKS } from "@/lib/stocks";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the StockSelector component.
 */
export type StockSelectorProps = {
  /** Currently selected stock symbol */
  selectedSymbol: string;
  /** Callback fired when selection changes */
  onChange: (symbol: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dropdown selector for choosing a single stock symbol.
 *
 * Displays all available NASDAQ stocks with their symbols and company names.
 * The component is accessible and supports keyboard navigation.
 */
export function StockSelector({
  selectedSymbol,
  onChange,
  disabled = false,
}: StockSelectorProps): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="stock-selector"
        className="text-xs font-medium text-neutral-400"
      >
        Symbol
      </label>
      <select
        id="stock-selector"
        className="rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-1.5 text-sm text-neutral-100 transition-colors hover:border-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-60"
        value={selectedSymbol}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {NASDAQ_STOCKS.map((stock) => (
          <option key={stock.symbol} value={stock.symbol}>
            {stock.symbol} — {stock.name}
          </option>
        ))}
      </select>
    </div>
  );
}
