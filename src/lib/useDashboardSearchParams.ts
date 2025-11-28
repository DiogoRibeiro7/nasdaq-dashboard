"use client";

/**
 * Custom hook for managing dashboard URL search parameters.
 *
 * Syncs the selected stock symbol and time range with the URL query string,
 * enabling shareable links and browser history navigation.
 */

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { VALID_SYMBOLS } from "./stocks";
import type { TimeRange } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default stock symbol when none is specified or invalid */
const DEFAULT_SYMBOL = "AAPL";

/** Default time range when none is specified or invalid */
const DEFAULT_RANGE: TimeRange = "3M";

/** Valid time range values for validation */
const VALID_RANGES = new Set<string>(["1M", "3M", "6M", "1Y", "MAX"]);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return type for the useDashboardSearchParams hook.
 */
export type DashboardSearchParams = {
  /** Currently selected stock symbol (validated, defaults to AAPL) */
  symbol: string;
  /** Currently selected time range (validated, defaults to 3M) */
  range: TimeRange;
  /** Update the selected symbol in the URL */
  setSymbol: (symbol: string) => void;
  /** Update the selected time range in the URL */
  setRange: (range: TimeRange) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates and normalizes a symbol from URL params.
 * Returns the symbol in uppercase if valid, otherwise returns the default.
 */
function parseSymbol(value: string | null): string {
  if (!value) return DEFAULT_SYMBOL;

  const normalized = value.trim().toUpperCase();
  return VALID_SYMBOLS.has(normalized) ? normalized : DEFAULT_SYMBOL;
}

/**
 * Validates a time range from URL params.
 * Returns the range if valid, otherwise returns the default.
 */
function parseRange(value: string | null): TimeRange {
  if (!value) return DEFAULT_RANGE;

  const normalized = value.trim().toUpperCase();
  return VALID_RANGES.has(normalized) ? (normalized as TimeRange) : DEFAULT_RANGE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for reading and updating dashboard URL search parameters.
 *
 * Provides reactive access to `symbol` and `range` query params with:
 * - Automatic validation (invalid values fall back to defaults)
 * - URL updates without full page reloads
 * - Type-safe setters
 *
 * @example
 * ```tsx
 * const { symbol, range, setSymbol, setRange } = useDashboardSearchParams();
 *
 * // URL: /?symbol=MSFT&range=1Y
 * console.log(symbol); // "MSFT"
 * console.log(range);  // "1Y"
 *
 * // Update URL to /?symbol=GOOGL&range=1Y
 * setSymbol("GOOGL");
 * ```
 */
export function useDashboardSearchParams(): DashboardSearchParams {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse and validate current values from URL
  const symbol = useMemo(
    () => parseSymbol(searchParams.get("symbol")),
    [searchParams],
  );

  const range = useMemo(
    () => parseRange(searchParams.get("range")),
    [searchParams],
  );

  /**
   * Updates the URL with new search params without causing a full page reload.
   */
  const updateSearchParams = useCallback(
    (updates: { symbol?: string; range?: TimeRange }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.symbol !== undefined) {
        params.set("symbol", updates.symbol);
      }
      if (updates.range !== undefined) {
        params.set("range", updates.range);
      }

      // Use replace to avoid polluting browser history with every change
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const setSymbol = useCallback(
    (newSymbol: string) => {
      const validated = parseSymbol(newSymbol);
      updateSearchParams({ symbol: validated });
    },
    [updateSearchParams],
  );

  const setRange = useCallback(
    (newRange: TimeRange) => {
      updateSearchParams({ range: newRange });
    },
    [updateSearchParams],
  );

  return { symbol, range, setSymbol, setRange };
}
