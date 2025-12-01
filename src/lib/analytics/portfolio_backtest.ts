export type RebalanceFrequency = "daily" | "weekly" | "monthly";

export type TargetWeights = Record<string, number>;

export type PortfolioBacktestParams = {
  initialEquity: number;
  pricesBySymbol: Record<string, { date: string; close: number }[]>;
  targetWeights: TargetWeights;
  frequency: RebalanceFrequency;
  transactionCostBps?: number;
};

export type PortfolioBacktestResult = {
  equityCurve: { date: string; equity: number; drawdown: number }[];
  weightsOverTime: { date: string; weights: TargetWeights }[];
  turnover: number;
  totalReturn: number;
  maxDrawdown: number;
  cagr: number | null;
};

export function backtestPortfolio(
  params: PortfolioBacktestParams,
): PortfolioBacktestResult {
  const aligned = alignPriceSeries(params.pricesBySymbol);
  if (aligned.dates.length === 0) {
    return emptyResult();
  }

  const transactionCostRate =
    (params.transactionCostBps ?? 0) / 10_000;

  let equity = Math.max(params.initialEquity, 1);
  const holdings: Record<string, number> = {};
  const weightsHistory: { date: string; weights: TargetWeights }[] = [];
  const equityCurve: { date: string; equity: number; drawdown: number }[] = [];
  const tradeNotionalHistory: number[] = [];

  const initialAllocation = rebalance(
    aligned,
    0,
    params.targetWeights,
    holdings,
    equity,
    transactionCostRate,
  );
  equity = initialAllocation.equity;
  tradeNotionalHistory.push(initialAllocation.tradeNotional);
  weightsHistory.push({
    date: aligned.dates[0],
    weights: computeWeights(holdings, aligned.priceMatrix[0]),
  });
  equityCurve.push({
    date: aligned.dates[0],
    equity,
    drawdown: 0,
  });

  let peak = equity;
  let lastRebalanceIndex = 0;

  for (let i = 1; i < aligned.dates.length; i++) {
    const date = aligned.dates[i];
    const priceRow = aligned.priceMatrix[i];
    const prevPriceRow = aligned.priceMatrix[i - 1];

    let dailyEquity = 0;
    for (const symbol of aligned.symbols) {
      const price = priceRow[symbol];
      const prevPrice = prevPriceRow[symbol];
      if (price !== null && prevPrice !== null && holdings[symbol] !== undefined) {
        const positionValue = holdings[symbol] * price;
        dailyEquity += positionValue;
      } else if (holdings[symbol] !== undefined && price !== null) {
        dailyEquity += holdings[symbol] * price;
      }
    }
    equity = dailyEquity;

    const shouldRebalance = needsRebalance(
      params.frequency,
      i,
      aligned.dates,
      lastRebalanceIndex,
    );

    if (shouldRebalance) {
      const rebalanceResult = rebalance(
        aligned,
        i,
        params.targetWeights,
        holdings,
        equity,
        transactionCostRate,
      );
      equity = rebalanceResult.equity;
      tradeNotionalHistory.push(rebalanceResult.tradeNotional);
      lastRebalanceIndex = i;
      weightsHistory.push({
        date,
        weights: computeWeights(holdings, priceRow),
      });
    }

    if (equity > peak) {
      peak = equity;
    }
    const drawdown = peak > 0 ? equity / peak - 1 : 0;
    equityCurve.push({ date, equity, drawdown });
  }

  const turnover = computeTurnover(tradeNotionalHistory, equityCurve);
  const totalReturn = equityCurve[equityCurve.length - 1].equity / equityCurve[0].equity - 1;
  const maxDrawdown = Math.min(...equityCurve.map((point) => point.drawdown));
  const cagr = computeCagr(equityCurve);

  return {
    equityCurve,
    weightsOverTime: weightsHistory,
    turnover,
    totalReturn,
    maxDrawdown,
    cagr,
  };
}

function emptyResult(): PortfolioBacktestResult {
  return {
    equityCurve: [],
    weightsOverTime: [],
    turnover: 0,
    totalReturn: 0,
    maxDrawdown: 0,
    cagr: null,
  };
}

function alignPriceSeries(
  pricesBySymbol: Record<string, { date: string; close: number }[]>,
): {
  symbols: string[];
  dates: string[];
  priceMatrix: Record<string, number | null>[];
} {
  const symbols = Object.keys(pricesBySymbol);
  if (symbols.length === 0) {
    return { symbols: [], dates: [], priceMatrix: [] };
  }

  const dateSets = symbols.map((symbol) =>
    new Set(pricesBySymbol[symbol].map((point) => point.date)),
  );
  let commonDates = new Set<string>(dateSets[0]);
  for (let i = 1; i < dateSets.length; i++) {
    const intersection = new Set<string>();
    for (const date of commonDates) {
      if (dateSets[i].has(date)) {
        intersection.add(date);
      }
    }
    commonDates = intersection;
  }

  const dates = Array.from(commonDates).sort();
  const priceMatrix = dates.map((date) => {
    const row: Record<string, number | null> = {};
    for (const symbol of symbols) {
      const price = pricesBySymbol[symbol].find((point) => point.date === date)?.close ?? null;
      row[symbol] = price;
    }
    return row;
  });

  return { symbols, dates, priceMatrix };
}

function rebalance(
  aligned: {
    symbols: string[];
    priceMatrix: Record<string, number | null>[];
    dates: string[];
  },
  index: number,
  targetWeights: TargetWeights,
  holdings: Record<string, number>,
  equity: number,
  transactionCostRate: number,
): { equity: number; tradeNotional: number } {
  const priceRow = aligned.priceMatrix[index];
  let tradeNotional = 0;

  for (const symbol of aligned.symbols) {
    const price = priceRow[symbol];
    const weight = targetWeights[symbol] ?? 0;
    if (price === null) {
      continue;
    }
    const targetValue = equity * weight;
    const currentValue = (holdings[symbol] ?? 0) * price;
    const deltaValue = targetValue - currentValue;
    tradeNotional += Math.abs(deltaValue);
    holdings[symbol] = targetValue / price;
  }

  const cost = tradeNotional * transactionCostRate;
  const newEquity = equity - cost;

  return { equity: newEquity, tradeNotional };
}

function computeWeights(
  holdings: Record<string, number>,
  priceRow: Record<string, number | null>,
): TargetWeights {
  const weights: TargetWeights = {};
  let totalValue = 0;
  for (const symbol of Object.keys(holdings)) {
    const price = priceRow[symbol];
    if (price !== null) {
      totalValue += holdings[symbol] * price;
    }
  }
  for (const symbol of Object.keys(holdings)) {
    const price = priceRow[symbol];
    if (price !== null && totalValue > 0) {
      weights[symbol] = (holdings[symbol] * price) / totalValue;
    }
  }
  return weights;
}

function needsRebalance(
  frequency: RebalanceFrequency,
  index: number,
  dates: string[],
  lastRebalanceIndex: number,
): boolean {
  switch (frequency) {
    case "daily":
      return true;
    case "weekly":
      return index - lastRebalanceIndex >= 5;
    case "monthly": {
      const prevDate = new Date(dates[lastRebalanceIndex]);
      const currentDate = new Date(dates[index]);
      return (
        currentDate.getMonth() !== prevDate.getMonth() ||
        currentDate.getFullYear() !== prevDate.getFullYear()
      );
    }
    default:
      return false;
  }
}

function computeTurnover(
  tradeNotionals: number[],
  equityCurve: { equity: number }[],
): number {
  if (tradeNotionals.length === 0 || equityCurve.length === 0) {
    return 0;
  }
  const totalTrade = tradeNotionals.reduce((sum, value) => sum + value, 0);
  const avgEquity =
    equityCurve.reduce((sum, point) => sum + point.equity, 0) /
    equityCurve.length;
  return avgEquity > 0 ? totalTrade / avgEquity : 0;
}

function computeCagr(
  equityCurve: { date: string; equity: number }[],
): number | null {
  if (equityCurve.length < 2) {
    return null;
  }
  const startEquity = equityCurve[0].equity;
  const endEquity = equityCurve[equityCurve.length - 1].equity;
  if (startEquity <= 0 || endEquity <= 0) {
    return null;
  }
  const startDate = new Date(equityCurve[0].date);
  const endDate = new Date(equityCurve[equityCurve.length - 1].date);
  const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years <= 0) {
    return null;
  }
  return (endEquity / startEquity) ** (1 / years) - 1;
}
