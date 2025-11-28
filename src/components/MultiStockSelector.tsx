"use client";

import { NASDAQ_STOCKS, type StockTicker } from "@/lib/stocks";

type MultiStockSelectorProps = {
  selectedSymbols: string[];
  onChange: (symbols: string[]) => void;
  maxSelected?: number;
  disabled?: boolean;
};

/**
 * Checkbox-based selector for multiple stock symbols.
 *
 * It enforces an upper bound on the number of selected tickers so that
 * we do not exceed API rate limits with too many parallel requests.
 */
export function MultiStockSelector({
  selectedSymbols,
  onChange,
  maxSelected = 4,
  disabled = false,
}: MultiStockSelectorProps) {
  const handleToggle = (symbol: string) => {
    if (disabled) return;

    const isSelected = selectedSymbols.includes(symbol);
    if (isSelected) {
      onChange(selectedSymbols.filter((s) => s !== symbol));
      return;
    }

    if (selectedSymbols.length >= maxSelected) {
      return;
    }

    onChange([...selectedSymbols, symbol]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Compare tickers</span>
        <span className="text-xs text-neutral-400">
          {selectedSymbols.length} / {maxSelected} selected
        </span>
      </div>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-xs">
        <ul className="space-y-1">
          {NASDAQ_STOCKS.map((stock: StockTicker) => (
            <li
              key={stock.symbol}
              className="flex items-center justify-between gap-2"
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3 w-3 rounded border-neutral-600 bg-neutral-900"
                  checked={selectedSymbols.includes(stock.symbol)}
                  onChange={() => handleToggle(stock.symbol)}
                  disabled={disabled}
                />
                <span>
                  <span className="font-semibold">{stock.symbol}</span>
                  <span className="ml-1 text-neutral-400">
                    {stock.name}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
