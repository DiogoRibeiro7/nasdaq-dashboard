/**
 * Comparison operators supported inside strategy conditions.
 */
export type ComparisonOperator = ">" | "<" | ">=" | "<=" | "==" | "!=";

/**
 * Supported indicator types that can be referenced inside a strategy config.
 *
 * - `price`: closing price for the symbol on the given date
 * - `ma`: simple moving average (requires `window`)
 * - `rsi`: relative strength index (requires `period`)
 * - `regime`: categorical regime label (e.g., "uptrend")
 */
export type IndicatorType = "price" | "ma" | "rsi" | "regime";

/**
 * Reference to an indicator time series. `params` are optional and depend on the indicator.
 */
export type IndicatorRef = {
  type: IndicatorType;
  params?: Record<string, number | string>;
};

/**
 * Comparison between two indicator references or indicator vs constant.
 */
export type Condition = {
  left: IndicatorRef;
  op: ComparisonOperator;
  right: IndicatorRef | { const: number | string };
};

/**
 * Declarative strategy definition. Each condition array must have all rules satisfied
 * to trigger the respective state transition.
 */
export type StrategyConfig = {
  name: string;
  longEntry?: Condition[];
  longExit?: Condition[];
  shortEntry?: Condition[];
  shortExit?: Condition[];
  allowShort?: boolean;
};

/**
 * Serialises indicator type + params into a stable lookup key for indicator maps.
 */
export function serializeIndicatorKey(
  type: IndicatorType,
  params?: Record<string, number | string>,
): string {
  if (!params || Object.keys(params).length === 0) {
    return type;
  }
  const sortedKeys = Object.keys(params).sort();
  const parts = sortedKeys.map((key) => `${key}=${params[key]}`);
  return `${type}:${parts.join("|")}`;
}

/**
 * Predefined strategies surfaced in the Strategy Lab dropdown.
 */
export const PREDEFINED_STRATEGIES: StrategyConfig[] = [
  {
    name: "MA Crossover (20/50)",
    longEntry: [
      {
        left: { type: "ma", params: { window: 20 } },
        op: ">",
        right: { type: "ma", params: { window: 50 } },
      },
    ],
    longExit: [
      {
        left: { type: "ma", params: { window: 20 } },
        op: "<",
        right: { type: "ma", params: { window: 50 } },
      },
    ],
    allowShort: false,
  },
  {
    name: "RSI Oversold/Overbought",
    longEntry: [
      {
        left: { type: "rsi", params: { period: 14 } },
        op: "<",
        right: { const: 30 },
      },
    ],
    longExit: [
      {
        left: { type: "rsi", params: { period: 14 } },
        op: ">",
        right: { const: 60 },
      },
    ],
    shortEntry: [
      {
        left: { type: "rsi", params: { period: 14 } },
        op: ">",
        right: { const: 70 },
      },
    ],
    shortExit: [
      {
        left: { type: "rsi", params: { period: 14 } },
        op: "<",
        right: { const: 40 },
      },
    ],
    allowShort: true,
  },
  {
    name: "Regime: Uptrend only",
    longEntry: [
      {
        left: { type: "regime" },
        op: "==",
        right: { const: "uptrend" },
      },
    ],
    longExit: [
      {
        left: { type: "regime" },
        op: "!=",
        right: { const: "uptrend" },
      },
    ],
    allowShort: false,
  },
];
