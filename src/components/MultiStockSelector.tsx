"use client";

import type { JSX } from "react";
import { ALL_SYMBOLS } from "@/lib/stocks";

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
        <span className="text-sm font-medium text-neutral-200">Compare tickers</span>
        <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
          {selectedSymbols.length} / {maxSelected}
        </span>
      </div>
      <div className="max-h-40 overflow-y-auto rounded-xl border border-neutral-700/50 bg-neutral-900/80 p-1.5 text-xs scrollbar-thin">
        <ul className="space-y-0.5" role="listbox" aria-label="Stock selection">
          {ALL_SYMBOLS.map((stock) => {
            const isSelected = selectedSymbols.includes(stock.symbol);
            const isAtLimit = selectedSymbols.length >= maxSelected;
            const isEffectivelyDisabled = disabled || (!isSelected && isAtLimit);

            return (
              <li key={stock.symbol}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                    isSelected
                      ? "bg-neutral-700/50 text-neutral-100"
                      : isEffectivelyDisabled
                        ? "cursor-not-allowed text-neutral-600"
                        : "text-neutral-300 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-800 text-neutral-100 accent-neutral-100 focus:ring-1 focus:ring-neutral-500 focus:ring-offset-0"
                    checked={isSelected}
                    onChange={() => handleToggle(stock.symbol)}
                    disabled={isEffectivelyDisabled}
                    aria-label={`${stock.symbol} - ${stock.name}`}
                  />
                  <span className="flex-1 truncate">
                    <span className="font-semibold">{stock.symbol}</span>
                    <span className="ml-1.5 text-neutral-500">{stock.name}</span>
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
