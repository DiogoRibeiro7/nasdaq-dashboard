"use client";

import type { JSX } from "react";
import type { CorrelationMatrix } from "@/lib/stats";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the CorrelationHeatmap component.
 */
export type CorrelationHeatmapProps = {
  /** Correlation matrix data to display */
  matrix: CorrelationMatrix;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a correlation value (-1 to 1) to a background color.
 * Uses a diverging color scale: red (-1) -> white (0) -> green (+1)
 *
 * @param value - Correlation coefficient
 * @returns Tailwind-compatible RGB color string
 */
function getCorrelationColor(value: number): string {
  if (!Number.isFinite(value)) {
    return "rgb(64, 64, 64)"; // neutral-700 for NaN
  }

  // Clamp value to [-1, 1]
  const clamped = Math.max(-1, Math.min(1, value));

  if (clamped >= 0) {
    // Positive correlation: white to green
    // 0 = rgb(255, 255, 255), 1 = rgb(34, 197, 94) (green-500)
    const intensity = clamped;
    const r = Math.round(255 - (255 - 34) * intensity);
    const g = Math.round(255 - (255 - 197) * intensity);
    const b = Math.round(255 - (255 - 94) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Negative correlation: white to red
    // 0 = rgb(255, 255, 255), -1 = rgb(239, 68, 68) (red-500)
    const intensity = Math.abs(clamped);
    const r = Math.round(255 - (255 - 239) * intensity);
    const g = Math.round(255 - (255 - 68) * intensity);
    const b = Math.round(255 - (255 - 68) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Determines appropriate text color for contrast against background.
 *
 * @param value - Correlation coefficient
 * @returns CSS color class for text
 */
function getTextColor(value: number): string {
  if (!Number.isFinite(value)) {
    return "text-neutral-400";
  }

  // Use dark text for light backgrounds (values near 0)
  // Use light text for saturated backgrounds (values near -1 or 1)
  const absValue = Math.abs(value);
  return absValue > 0.5 ? "text-white" : "text-neutral-900";
}

/**
 * Formats a correlation value for display.
 *
 * @param value - Correlation coefficient
 * @returns Formatted string
 */
function formatCorrelation(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Heatmap visualization of a correlation matrix.
 *
 * Displays correlations between stock symbols using a color-coded grid:
 * - Green: Positive correlation (up to +1)
 * - White: No correlation (0)
 * - Red: Negative correlation (down to -1)
 *
 * @example
 * ```tsx
 * <CorrelationHeatmap
 *   matrix={{
 *     symbols: ["AAPL", "MSFT", "GOOGL"],
 *     values: [[1, 0.8, 0.7], [0.8, 1, 0.6], [0.7, 0.6, 1]]
 *   }}
 * />
 * ```
 */
export function CorrelationHeatmap({
  matrix,
}: CorrelationHeatmapProps): JSX.Element {
  const { symbols, values } = matrix;

  if (symbols.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-neutral-400">
        No data available for correlation matrix.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Header row with column labels */}
        <div className="flex">
          {/* Empty corner cell */}
          <div className="w-16 shrink-0" />
          {/* Column headers */}
          {symbols.map((symbol) => (
            <div
              key={`col-${symbol}`}
              className="flex w-16 shrink-0 items-center justify-center p-1"
            >
              <span className="text-xs font-semibold text-neutral-300">
                {symbol}
              </span>
            </div>
          ))}
        </div>

        {/* Data rows */}
        {symbols.map((rowSymbol, i) => (
          <div key={`row-${rowSymbol}`} className="flex">
            {/* Row header */}
            <div className="flex w-16 shrink-0 items-center justify-end pr-2">
              <span className="text-xs font-semibold text-neutral-300">
                {rowSymbol}
              </span>
            </div>
            {/* Data cells */}
            {symbols.map((colSymbol, j) => {
              const value = values[i]?.[j] ?? NaN;
              const bgColor = getCorrelationColor(value);
              const textColorClass = getTextColor(value);

              return (
                <div
                  key={`cell-${rowSymbol}-${colSymbol}`}
                  className="flex h-12 w-16 shrink-0 items-center justify-center border border-neutral-800"
                  style={{ backgroundColor: bgColor }}
                  title={`${rowSymbol} vs ${colSymbol}: ${formatCorrelation(value)}`}
                >
                  <span className={`text-xs font-medium ${textColorClass}`}>
                    {formatCorrelation(value)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-3 rounded"
              style={{ backgroundColor: getCorrelationColor(-1) }}
            />
            <span>-1 (inverse)</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-3 rounded border border-neutral-600"
              style={{ backgroundColor: getCorrelationColor(0) }}
            />
            <span>0 (none)</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="h-3 w-3 rounded"
              style={{ backgroundColor: getCorrelationColor(1) }}
            />
            <span>+1 (perfect)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
