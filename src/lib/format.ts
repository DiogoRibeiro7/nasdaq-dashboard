/**
 * Shared formatting helpers enforcing two decimal places across the UI.
 */

const DECIMAL_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a numeric value with two decimals.
 */
export function formatNumber(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return DECIMAL_FORMATTER.format(value);
}

/**
 * Formats a currency value with a leading dollar sign and two decimals.
 */
export function formatCurrency(
  value: number | null | undefined,
): string {
  const formatted = formatNumber(value);
  return formatted === "—" ? formatted : `$${formatted}`;
}

/**
 * Formats a decimal (e.g., 0.12) as a percentage string with two decimals.
 */
export function formatPercent(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${DECIMAL_FORMATTER.format(value * 100)}%`;
}

/**
 * Formats a numeric value for chart axes/tooltips where Infinity/NaN are not expected.
 */
export function formatAxisNumber(value: number): string {
  return DECIMAL_FORMATTER.format(value);
}

