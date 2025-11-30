import type {
  MaTrendPoint,
  RegimePoint,
} from "@/lib/stats";

export type PositionPoint = {
  date: string;
  position: -1 | 0 | 1;
};

export type GenericBacktestResult = {
  equityCurve: { date: string; equity: number; drawdown: number }[];
  totalReturn: number;
  maxDrawdown: number;
  cagr: number | null;
  trades: {
    entryDate: string;
    exitDate: string | null;
    direction: -1 | 1;
    entryPrice: number;
    exitPrice: number | null;
    grossReturn: number | null;
  }[];
  hitRate: number | null;
};

export function backtestSignals(
  prices: { date: string; close: number }[],
  positions: PositionPoint[],
): GenericBacktestResult | null {
  if (prices.length < 2) {
    return null;
  }

  const sortedPrices = [...prices].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const positionMap = new Map(positions.map((point) => [point.date, point.position]));

  const equitySeries: { date: string; equity: number }[] = [
    { date: sortedPrices[0].date, equity: 1 },
  ];

  let equity = 1;
  let prevPosition = positionMap.get(sortedPrices[0].date) ?? 0;
  let activeTrade:
    | {
        entryDate: string;
        entryPrice: number;
        direction: -1 | 1;
      }
    | null = null;
  const trades: GenericBacktestResult["trades"] = [];

  const openTrade = (date: string, price: number, direction: -1 | 1) => {
    activeTrade = {
      entryDate: date,
      entryPrice: price,
      direction,
    };
  };

  const closeTrade = (date: string, price: number) => {
    if (!activeTrade) {
      return;
    }
    const { entryDate, entryPrice, direction } = activeTrade;
    const grossReturn =
      direction === 1
        ? price / entryPrice - 1
        : entryPrice / price - 1;
    trades.push({
      entryDate,
      exitDate: date,
      direction,
      entryPrice,
      exitPrice: price,
      grossReturn: Number.isFinite(grossReturn) ? grossReturn : null,
    });
    activeTrade = null;
  };

  if (prevPosition !== 0) {
    openTrade(sortedPrices[0].date, sortedPrices[0].close, prevPosition);
  }

  for (let i = 0; i < sortedPrices.length - 1; i++) {
    const currentDate = sortedPrices[i].date;
    const currentPrice = sortedPrices[i].close;
    const nextPrice = sortedPrices[i + 1].close;

    const desiredPosition =
      positionMap.get(currentDate) ?? prevPosition;

    if (desiredPosition !== prevPosition) {
      if (prevPosition !== 0) {
        closeTrade(currentDate, currentPrice);
      }
      if (desiredPosition !== 0) {
        openTrade(currentDate, currentPrice, desiredPosition);
      }
    }

    const ret =
      currentPrice > 0 && nextPrice > 0
        ? nextPrice / currentPrice - 1
        : 0;
    equity *= 1 + desiredPosition * ret;
    equitySeries.push({
      date: sortedPrices[i + 1].date,
      equity,
    });

    prevPosition = desiredPosition;
  }

  if (prevPosition !== 0) {
    const lastPrice = sortedPrices[sortedPrices.length - 1].close;
    closeTrade(sortedPrices[sortedPrices.length - 1].date, lastPrice);
  }

  const totalReturn = equitySeries[equitySeries.length - 1].equity - 1;
  const { curveWithDrawdown, maxDrawdown } = computeDrawdownFromEquity(equitySeries);
  const cagr =
    equitySeries.length > 1
      ? computeCagr(
          equitySeries[0].date,
          equitySeries[equitySeries.length - 1].date,
          totalReturn,
        )
      : null;

  let hitRate: number | null = null;
  if (trades.length > 0) {
    const profitable = trades.filter(
      (trade) => trade.grossReturn !== null && trade.grossReturn > 0,
    ).length;
    hitRate = profitable / trades.length;
  }

  return {
    equityCurve: curveWithDrawdown,
    totalReturn,
    maxDrawdown,
    cagr,
    trades,
    hitRate,
  };
}

export function generateMaCrossoverSignals(
  maData: MaTrendPoint[],
): PositionPoint[] {
  return maData.map((point) => {
    if (point.maShort === null || point.maLong === null) {
      return { date: point.date, position: 0 };
    }
    if (point.maShort > point.maLong) {
      return { date: point.date, position: 1 };
    }
    if (point.maShort < point.maLong) {
      return { date: point.date, position: -1 };
    }
    return { date: point.date, position: 0 };
  });
}

export function generateRsiBandSignals(
  rsiSeries: { date: string; rsi: number | null }[],
  lower: number,
  upper: number,
): PositionPoint[] {
  return rsiSeries.map((point) => {
    if (point.rsi === null) {
      return { date: point.date, position: 0 };
    }
    if (point.rsi < lower) {
      return { date: point.date, position: 1 };
    }
    if (point.rsi > upper) {
      return { date: point.date, position: -1 };
    }
    return { date: point.date, position: 0 };
  });
}

export function generateRegimeFilterSignals(
  regimes: RegimePoint[],
): PositionPoint[] {
  return regimes.map((point) => ({
    date: point.date,
    position: point.regime === "uptrend" ? 1 : 0,
  }));
}

function computeDrawdownFromEquity(
  curve: { date: string; equity: number }[],
): {
  curveWithDrawdown: { date: string; equity: number; drawdown: number }[];
  maxDrawdown: number;
} {
  let peak = -Infinity;
  let maxDrawdown = 0;
  const result: { date: string; equity: number; drawdown: number }[] = [];

  for (const point of curve) {
    if (point.equity > peak) {
      peak = point.equity;
    }
    const drawdown = peak === 0 ? 0 : point.equity / peak - 1;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
    result.push({ ...point, drawdown });
  }

  return { curveWithDrawdown: result, maxDrawdown };
}

function computeCagr(
  startDate: string,
  endDate: string,
  totalReturn: number,
): number | null {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msDiff = end.getTime() - start.getTime();
  if (msDiff <= 0) {
    return null;
  }
  const years = msDiff / (1000 * 60 * 60 * 24 * 365.25);
  if (years <= 0) {
    return null;
  }
  return (1 + totalReturn) ** (1 / years) - 1;
}
