export type GlossaryEntry = {
  id: string;
  title: string;
  description: string;
};

const DATA = [
  {
    id: "price-chart",
    title: "Price history",
    description:
      "Closing prices over the selected range. Markers flag notable gaps and abnormal volume so you can spot market reactions at a glance.",
  },
  {
    id: "event-detection",
    title: "Event detection",
    description:
      "Gap = open vs previous close. Volume spike = z-score vs average volume. Biggest moves rank days by absolute return.",
  },
  {
    id: "risk-cards",
    title: "Risk & return cards",
    description:
      "Quick stats such as trailing returns and annualised volatility help you gauge momentum and variability.",
  },
  {
    id: "trend-signals",
    title: "Trend signals",
    description:
      "Moving-average crossovers contrast fast vs slow trends. Golden cross = bullish (short MA rises above long MA); death cross = bearish.",
  },
  {
    id: "regime-classification",
    title: "Regime classification",
    description:
      "Combines moving averages, RSI, and realised volatility to tag each day as uptrend, downtrend, sideways, or high-volatility.",
  },
  {
    id: "momentum",
    title: "Momentum oscillators",
    description:
      "RSI highlights overbought/oversold zones while MACD compares fast vs slow exponential averages to reveal momentum shifts.",
  },
  {
    id: "capm",
    title: "Benchmark analytics",
    description:
      "CAPM regression vs QQQ estimates beta (sensitivity), daily/annual alpha (excess return), and R² (fit).",
  },
  {
    id: "return-distribution",
    title: "Return distribution",
    description:
      "Histogram of daily log returns, useful for spotting skewness and fat tails.",
  },
  {
    id: "risk-profile",
    title: "Risk profile",
    description:
      "Summarises higher moments (mean, volatility, skew, kurtosis) plus Sharpe ratio for risk-adjusted performance.",
  },
  {
    id: "serial-dependence",
    title: "Serial dependence",
    description:
      "Autocorrelation (ACF) and Ljung–Box tests check whether returns or volatility exhibit persistence.",
  },
  {
    id: "seasonality",
    title: "Seasonality",
    description:
      "Average daily returns grouped by weekday or month highlight recurring calendar patterns. Use sample counts to judge reliability.",
  },
  {
    id: "advanced-analytics",
    title: "Rolling analytics",
    description:
      "Rolling volatility/return/drawdown views show how risk evolves over time instead of only relying on full-period averages.",
  },
  {
    id: "multi-comparison",
    title: "Multi-stock comparison",
    description:
      "Normalises each selected ticker to 1 at the range start so you can compare relative performance on the same scale.",
  },
  {
    id: "correlation-matrix",
    title: "Correlation matrix",
    description:
      "Pairwise daily-return correlations help you understand diversification benefits (red = inverse, green = positive).",
  },
  {
    id: "equal-weight-portfolio",
    title: "Equal-weight portfolio",
    description:
      "Simulates investing equally across the selected tickers, tracking total return, drawdown, volatility, and Sharpe.",
  },
  {
    id: "rolling-correlations",
    title: "Rolling correlations",
    description:
      "Shows how correlation between the chosen reference ticker and others evolves across different windows.",
  },
  {
    id: "screener",
    title: "Screener & ranking",
    description:
      "Ranks every symbol in the NASDAQ universe by momentum, volatility, and Sharpe so you can quickly spot leaders or laggards.",
  },
  {
    id: "forecast",
    title: "Price forecast",
    description:
      "Baseline models (naive, rolling average, EWMA) offer a quick view of expected closes with simple confidence bands.",
  },
  {
    id: "risk-model",
    title: "Risk model (PCA)",
    description:
      "Principal components of cross-sectional returns help explain shared risk factors and exposures across the universe.",
  },
  {
    id: "risk-tail",
    title: "VaR & Expected Shortfall",
    description:
      "Value-at-Risk estimates the worst expected loss at a confidence level; Expected Shortfall averages losses beyond VaR to capture tail severity.",
  },
] as const;

export type GlossaryId = (typeof DATA)[number]["id"];
export type GlossaryEntryDefinition = (typeof DATA)[number];

const MAP: Record<string, GlossaryEntryDefinition> = DATA.reduce(
  (acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  },
  {} as Record<string, GlossaryEntryDefinition>,
);

export function getGlossaryEntry(id: GlossaryId): GlossaryEntryDefinition {
  return MAP[id];
}

export const glossaryEntries: GlossaryEntryDefinition[] = [...DATA];
