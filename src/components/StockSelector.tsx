"use client";

import { NASDAQ_STOCKS, type StockTicker } from "@/lib/stocks";

type StockSelectorProps = {
  selectedSymbol: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
};

/**
 * Dropdown selector for a single stock symbol.
 */
export function StockSelector({
  selectedSymbol,
  onChange,
  disabled = false,
}: StockSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">Symbol</label>
      <select
        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm disabled:opacity-60"
        value={selectedSymbol}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {NASDAQ_STOCKS.map((stock: StockTicker) => (
          <option key={stock.symbol} value={stock.symbol}>
            {stock.symbol} — {stock.name}
          </option>
        ))}
      </select>
    </div>
  );
}
