import type { PositionPoint } from "@/lib/analytics/backtest";
import {
  serializeIndicatorKey,
  type ComparisonOperator,
  type Condition,
  type IndicatorRef,
  type IndicatorType,
  type StrategyConfig,
} from "@/lib/analytics/strategy_config";

export type IndicatorSeriesMap = {
  price: { date: string; value: number }[];
  ma: Record<string, { date: string; value: number | null }[]>;
  rsi: Record<string, { date: string; value: number | null }[]>;
  regime: { date: string; value: string }[];
};

type IndicatorValue =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string };

type IndicatorLookup = {
  price: Map<string, number>;
  ma: Map<string, Map<string, number | null>>;
  rsi: Map<string, Map<string, number | null>>;
  regime: Map<string, string>;
};

export function generateSignalsFromConfig(
  dates: string[],
  indicators: IndicatorSeriesMap,
  config: StrategyConfig,
): PositionPoint[] {
  if (dates.length === 0) {
    return [];
  }

  const lookup = buildIndicatorLookup(indicators);
  const positions: PositionPoint[] = [];
  let currentPosition: -1 | 0 | 1 = 0;

  for (const date of dates) {
    const longEntryEval = evaluateConditions(config.longEntry, date, lookup);
    const longExitEval = evaluateConditions(config.longExit, date, lookup);
    const shortEntryEval =
      config.allowShort === true
        ? evaluateConditions(config.shortEntry, date, lookup)
        : false;
    const shortExitEval =
      config.allowShort === true
        ? evaluateConditions(config.shortExit, date, lookup)
        : false;

    const evaluations = [
      longEntryEval,
      longExitEval,
      shortEntryEval,
      shortExitEval,
    ].filter((value) => value !== false);

    if (evaluations.some((value) => value === null)) {
      positions.push({ date, position: currentPosition });
      continue;
    }

    let nextPosition: -1 | 0 | 1 = currentPosition;

    if (currentPosition === 1 && longExitEval === true) {
      nextPosition = 0;
    }
    if (currentPosition === -1 && shortExitEval === true) {
      nextPosition = 0;
    }

    if (longEntryEval === true && nextPosition !== 1) {
      nextPosition = 1;
    } else if (
      config.allowShort === true &&
      shortEntryEval === true &&
      nextPosition !== -1
    ) {
      nextPosition = -1;
    }

    currentPosition = nextPosition;
    positions.push({ date, position: currentPosition });
  }

  return positions;
}

function buildIndicatorLookup(
  indicators: IndicatorSeriesMap,
): IndicatorLookup {
  const price = new Map<string, number>();
  for (const point of indicators.price ?? []) {
    price.set(point.date, point.value);
  }

  const ma = new Map<string, Map<string, number | null>>();
  for (const [key, series] of Object.entries(indicators.ma ?? {})) {
    ma.set(key, new Map(series.map((point) => [point.date, point.value])));
  }

  const rsi = new Map<string, Map<string, number | null>>();
  for (const [key, series] of Object.entries(indicators.rsi ?? {})) {
    rsi.set(key, new Map(series.map((point) => [point.date, point.value])));
  }

  const regime = new Map<string, string>();
  for (const point of indicators.regime ?? []) {
    regime.set(point.date, point.value);
  }

  return { price, ma, rsi, regime };
}

function evaluateConditions(
  conditions: Condition[] | undefined,
  date: string,
  lookup: IndicatorLookup,
): boolean | null {
  if (!conditions || conditions.length === 0) {
    return false;
  }

  for (const condition of conditions) {
    const result = evaluateCondition(condition, date, lookup);
    if (result === null) {
      return null;
    }
    if (!result) {
      return false;
    }
  }

  return true;
}

function evaluateCondition(
  condition: Condition,
  date: string,
  lookup: IndicatorLookup,
): boolean | null {
  const left = resolveIndicatorValue(condition.left, date, lookup);
  let right: IndicatorValue | null;
  if ("const" in condition.right) {
    const constValue = condition.right.const;
    if (typeof constValue === "number") {
      right = { kind: "number", value: constValue };
    } else {
      right = { kind: "string", value: constValue };
    }
  } else {
    right = resolveIndicatorValue(condition.right, date, lookup);
  }

  if (!left || !right) {
    return null;
  }

  if (left.kind !== right.kind && !allEqualityOperators(condition.op)) {
    return false;
  }

  if (left.kind === "number" && right.kind === "number") {
    return compareNumbers(left.value, right.value, condition.op);
  }

  if (left.kind === "string" && right.kind === "string") {
    return compareStrings(left.value, right.value, condition.op);
  }

  return false;
}

function allEqualityOperators(op: ComparisonOperator): boolean {
  return op === "==" || op === "!=";
}

function compareNumbers(
  left: number,
  right: number,
  op: ComparisonOperator,
): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }
  switch (op) {
    case ">":
      return left > right;
    case "<":
      return left < right;
    case ">=":
      return left >= right;
    case "<=":
      return left <= right;
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    default:
      return false;
  }
}

function compareStrings(
  left: string,
  right: string,
  op: ComparisonOperator,
): boolean {
  if (op === "==") {
    return left === right;
  }
  if (op === "!=") {
    return left !== right;
  }
  return false;
}

function resolveIndicatorValue(
  ref: IndicatorRef,
  date: string,
  lookup: IndicatorLookup,
): IndicatorValue | null {
  switch (ref.type) {
    case "price": {
      const value = lookup.price.get(date);
      return typeof value === "number" ? { kind: "number", value } : null;
    }
    case "ma": {
      const key = serializeIndicatorKey("ma", ref.params);
      const series = lookup.ma.get(key);
      if (!series) return null;
      const value = series.get(date);
      return typeof value === "number"
        ? { kind: "number", value }
        : value === null
        ? null
        : null;
    }
    case "rsi": {
      const key = serializeIndicatorKey("rsi", ref.params);
      const series = lookup.rsi.get(key);
      if (!series) return null;
      const value = series.get(date);
      return typeof value === "number"
        ? { kind: "number", value }
        : value === null
        ? null
        : null;
    }
    case "regime": {
      const value = lookup.regime.get(date);
      return typeof value === "string" ? { kind: "string", value } : null;
    }
    default:
      return null;
  }
}
