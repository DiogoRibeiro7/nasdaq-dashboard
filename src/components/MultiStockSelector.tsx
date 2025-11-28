"use client";

import type { JSX } from "react";
import { NASDAQ_STOCKS } from "@/lib/stocks";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the MultiStockSelector component.
 */
export type MultiStockSelectorProps = {
  /** Array of currently selected stock symbols */
  selectedSymbols: string[];
  /** Callback fired when selection changes */
  onChange: (symbols: string[]) => void;
  /** Maximum number of stocks that can be selected (default: 4) */
  maxSelected?: number;
  /** Whether the selector is disabled */
  disabled?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checkbox-based selector for choosing multiple stock symbols.
 *
 * Enforces an upper bound on the number of selected tickers to prevent
 * excessive API calls. When the maximum is reached, unchecked options
 * become effectively disabled.
 *
 * @example
 * ```tsx
 * <MultiStockSelector
 *   selectedSymbols={["AAPL", "MSFT"]}
 *   onChange={setSelectedSymbols}
 *   maxSelected={4}
 * />
 * ```
 */
export function MultiStockSelector({
  selectedSymbols,
  onChange,
  maxSelected = 4,
  disabled = false,
}: MultiStockSelectorProps): JSX.Element {
  /**
   * Handles toggling a stock symbol's selection state.
   * Respects the maxSelected limit when adding new selections.
   */
  const handleToggle = (symbol: string): void => {
    if (disabled) return;

    const isSelected = selectedSymbols.includes(symbol);

    if (isSelected) {
      // Always allow deselection
      onChange(selectedSymbols.filter((s) => s !== symbol));
      return;
    }

    // Only allow selection if under the limit
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
        <ul className="space-y-1" role="listbox" aria-label="Stock selection">
          {NASDAQ_STOCKS.map((stock) => {
            const isSelected = selectedSymbols.includes(stock.symbol);
            const isAtLimit = selectedSymbols.length >= maxSelected;
            const isEffectivelyDisabled = disabled || (!isSelected && isAtLimit);

            return (
              <li
                key={stock.symbol}
                className="flex items-center justify-between gap-2"
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-neutral-600 bg-neutral-900"
                    checked={isSelected}
                    onChange={() => handleToggle(stock.symbol)}
                    disabled={isEffectivelyDisabled}
                    aria-label={`${stock.symbol} - ${stock.name}`}
                  />
                  <span>
                    <span className="font-semibold">{stock.symbol}</span>
                    <span className="ml-1 text-neutral-400">{stock.name}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
