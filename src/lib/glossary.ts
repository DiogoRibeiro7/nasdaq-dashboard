export type GlossaryEntry = {
  id: string;
  term: string;
  shortDefinition: string;
  longDefinition: string;
  category?: string;
  formulaLatex?: string;
};

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    id: "volatility_daily",
    term: "Daily volatility",
    shortDefinition:
      "Standard deviation of daily log returns – the typical day‑to‑day fluctuation.",
    longDefinition:
      "Daily volatility summarises how tightly packed daily log returns are around their mean. It is computed as the sample standard deviation of the range-selected returns and is the building block for annualised volatility and many risk ratios.",
    category: "Risk",
    formulaLatex: "\\sigma_{daily} = \\sqrt{\\frac{1}{N-1}\\sum (r_t-\\bar{r})^2}",
  },
  {
    id: "volatility_annualised",
    term: "Annualised volatility",
    shortDefinition:
      "Daily volatility scaled by \\(\\sqrt{252}\\) to express risk per trading year.",
    longDefinition:
      "Because investors usually quote risk on an annual basis, we multiply daily volatility by the square root of trading days (≈252) to approximate what dispersion would look like if daily swings were independent and identically distributed.",
    category: "Risk",
    formulaLatex: "\\sigma_{annual} = \\sigma_{daily} \\sqrt{252}",
  },
  {
    id: "sharpe_ratio",
    term: "Sharpe ratio",
    shortDefinition:
      "Risk-adjusted return: annualised excess return divided by annualised volatility.",
    longDefinition:
      "The Sharpe ratio measures how much return the strategy delivered per unit of volatility after accounting for the risk-free rate (assumed 0% in this dashboard). Positive Sharpe indicates compensation for risk; negative Sharpe means the strategy lagged a cash benchmark.",
    category: "Performance",
    formulaLatex: "Sharpe = \\frac{\\mu_{annual} - r_f}{\\sigma_{annual}}",
  },
  {
    id: "max_drawdown",
    term: "Maximum drawdown",
    shortDefinition:
      "Worst peak-to-trough decline experienced by the equity curve over the range.",
    longDefinition:
      "Drawdowns capture the path-dependent pain of a strategy. Maximum drawdown tracks the largest percentage drop from a running peak to a subsequent trough, highlighting capital erosion that volatility alone can miss.",
    category: "Risk",
  },
  {
    id: "cagr",
    term: "Compound annual growth rate (CAGR)",
    shortDefinition:
      "Equivalent constant annual return that compounds to the observed total return.",
    longDefinition:
      "CAGR normalises performance for the exact length of the backtest by asking: “What fixed annual rate would get me from starting equity to final equity over this time span?” It enables apples-to-apples comparisons across strategies with different durations.",
    category: "Performance",
    formulaLatex: "CAGR = \\left(\\frac{Equity_{end}}{Equity_{start}}\\right)^{1/years} - 1",
  },
  {
    id: "value_at_risk",
    term: "Value-at-Risk (VaR)",
    shortDefinition:
      "Loss threshold that should not be exceeded with a chosen confidence level.",
    longDefinition:
      "VaR answers the question: “With X% confidence, how much could I lose over the next horizon?” Historical VaR replays realised returns, while the normal approximation assumes IID Gaussian returns for a quick analytic estimate.",
    category: "Risk",
  },
  {
    id: "expected_shortfall",
    term: "Expected Shortfall (ES)",
    shortDefinition:
      "Average loss conditional on breaching the VaR threshold (also called CVaR).",
    longDefinition:
      "Expected Shortfall acknowledges that breaches happen and measures the average severity of those tail events. Because it integrates the entire tail beyond VaR, ES is considered a more stable and coherent tail-risk metric.",
    category: "Risk",
  },
  {
    id: "beta",
    term: "Beta",
    shortDefinition:
      "Sensitivity of the asset to benchmark movements (slope of CAPM regression).",
    longDefinition:
      "Beta quantifies how much the asset tends to move when the benchmark moves. A beta above 1 implies amplified swings versus the benchmark; a beta below 1 suggests dampened moves, while a negative beta indicates the asset often moves inversely to the market.",
    category: "Factor model",
    formulaLatex: "\\beta = \\frac{Cov(r_i, r_m)}{Var(r_m)}",
  },
  {
    id: "alpha_daily",
    term: "Alpha (daily)",
    shortDefinition:
      "Average daily excess return unexplained by beta exposure to the benchmark.",
    longDefinition:
      "Alpha is the intercept of the CAPM regression. Positive alpha means the asset delivered returns beyond what its beta would suggest; negative alpha indicates underperformance relative to the benchmark-adjusted expectation.",
    category: "Factor model",
  },
  {
    id: "alpha_annual",
    term: "Alpha (annualised)",
    shortDefinition:
      "Daily alpha compounded to a yearly rate for easier comparison against goals.",
    longDefinition:
      "Annual alpha scales the daily intercept to a yearly figure, showing how much extra (or less) return the asset delivered after accounting for beta. Compounding helps illustrate long-run edge or drag.",
    category: "Factor model",
  },
  {
    id: "r_squared",
    term: "R² (coefficient of determination)",
    shortDefinition:
      "Share of variance in asset returns explained by the benchmark regression.",
    longDefinition:
      "An R² close to 1 means the benchmark explains most of the asset’s moves (little idiosyncratic behaviour). A low R² indicates the asset is largely driven by idiosyncratic factors beyond the benchmark.",
    category: "Factor model",
  },
  {
    id: "pca",
    term: "Principal Component Analysis (PCA)",
    shortDefinition:
      "Linear transformation that decomposes correlated returns into orthogonal factors.",
    longDefinition:
      "PCA diagonalises the covariance matrix of cross-sectional returns. Each principal component represents a latent risk factor. The explained-variance chart shows how many components are needed to capture most of the universe’s co-movement.",
    category: "Risk model",
  },
  {
    id: "factor_loading",
    term: "Factor loading",
    shortDefinition:
      "Coefficient showing how strongly a security co-moves with a factor.",
    longDefinition:
      "In regression-based factor models, loadings (betas) measure exposure to each factor. A high absolute loading means the asset’s returns are strongly influenced by that factor’s movements.",
    category: "Factor model",
  },
  {
    id: "regime",
    term: "Market regime",
    shortDefinition:
      "Qualitative label (uptrend, downtrend, sideways, high-volatility) inferred from indicators.",
    longDefinition:
      "Combining moving averages, RSI, and realised volatility allows the dashboard to tag each day with a regime. These tags help filter signals, construct regime-aware strategies, or simply annotate charts with context.",
    category: "Strategy",
  },
  {
    id: "ma_crossover",
    term: "Moving-average crossover",
    shortDefinition:
      "Classic trend signal: go long when a fast MA rises above a slow MA and exit when it falls below.",
    longDefinition:
      "MA crossover strategies aim to capture medium-term trends. The dashboard supports configurable short/long windows so you can explore robustness, run backtests, or use the Strategy Lab to model custom entry/exit rules.",
    category: "Strategy",
  },
  {
    id: "rsi",
    term: "Relative Strength Index (RSI)",
    shortDefinition:
      "Oscillator bounded between 0 and 100 that compares average gains vs. losses.",
    longDefinition:
      "RSI highlights overbought (typically >70) and oversold (<30) regimes. Traders often use it for mean-reversion entries (buy pullbacks in uptrends) or to confirm divergences.",
    category: "Strategy",
  },
  {
    id: "turnover",
    term: "Turnover",
    shortDefinition:
      "Trading intensity measured as traded notional divided by average portfolio equity.",
    longDefinition:
      "High turnover implies frequent rebalancing or active trading, which can erode performance once transaction costs are considered. The custom portfolio backtester reports turnover alongside returns to highlight implementation frictions.",
    category: "Portfolio",
  },
  {
    id: "transaction_costs",
    term: "Transaction costs",
    shortDefinition:
      "Explicit or implicit costs incurred when trading (e.g., commissions, spreads, slippage).",
    longDefinition:
      "In the Strategy Lab and portfolio backtester we model costs as basis points of notional traded. Deducting these costs from equity after each rebalance helps approximate real-world performance.",
    category: "Portfolio",
  },
  {
    id: "efficient_frontier",
    term: "Efficient frontier",
    shortDefinition:
      "Set of portfolios that maximise expected return for each level of volatility under mean–variance assumptions.",
    longDefinition:
      "Sampling the weight space lets us approximate the frontier even without a quadratic-programming solver. The dashboard highlights min-variance and max-Sharpe portfolios so you can inspect their weights and risk/return profile.",
    category: "Portfolio",
  },
  {
    id: "min_variance_portfolio",
    term: "Minimum-variance portfolio",
    shortDefinition:
      "Portfolio on the frontier with the lowest possible volatility.",
    longDefinition:
      "The min-variance point ignores expected return and focuses purely on risk reduction. For long-only universes it tends to tilt toward low-volatility constituents and more diversified mixes.",
    category: "Portfolio",
  },
  {
    id: "max_sharpe_portfolio",
    term: "Maximum-Sharpe portfolio",
    shortDefinition:
      "Portfolio on the frontier with the highest risk-adjusted return relative to a risk-free rate.",
    longDefinition:
      "Also known as the tangency portfolio, the max-Sharpe solution maximises the slope of the capital market line. It often concentrates in higher-return assets but still accounts for diversification benefits.",
    category: "Portfolio",
  },
  {
    id: "return_distribution",
    term: "Return distribution",
    shortDefinition:
      "Histogram and higher moments of daily log returns over the selected range.",
    longDefinition:
      "Visualising the distribution of returns helps spot skewness, fat tails, and multi-modality. These features influence risk expectations, VaR/ES, and the suitability of models that assume normality.",
    category: "Risk",
  },
  {
    id: "risk_profile",
    term: "Risk profile",
    shortDefinition:
      "Card summarising mean, volatility, Sharpe, skewness, and kurtosis.",
    longDefinition:
      "The risk profile highlights not just dispersion but also asymmetry (skew) and tail thickness (kurtosis). Together they provide a quick diagnostic of whether returns are well-behaved or prone to extremes.",
    category: "Risk",
  },
  {
    id: "skewness",
    term: "Skewness",
    shortDefinition:
      "Measures asymmetry of the return distribution.",
    longDefinition:
      "Negative skew implies a heavier left tail (occasional large losses), while positive skew signals a heavier right tail (occasional outsized gains). Recognising skew helps set expectations about tail behaviour.",
    category: "Risk",
  },
  {
    id: "kurtosis",
    term: "Excess kurtosis",
    shortDefinition:
      "Indicates tail thickness relative to a normal distribution.",
    longDefinition:
      "Positive excess kurtosis means fat tails (more extreme events than normal), whereas negative values imply thinner tails. This metric complements VaR/ES by diagnosing how likely extreme moves are.",
    category: "Risk",
  },
  {
    id: "scenario_analysis",
    term: "Scenario analysis",
    shortDefinition:
      "What-if shocks applied to the latest equity level to gauge immediate impact.",
    longDefinition:
      "Scenario analysis lets you stress the strategy by applying hypothetical one-day returns (e.g., –10% selloff). It complements VaR/ES by focusing on specific narrative shocks rather than probabilistic thresholds.",
    category: "Stress testing",
  },
  {
    id: "factor_exposures",
    term: "Factor exposures",
    shortDefinition:
      "Regressing asset returns against proxy factors to estimate betas and residual risk.",
    longDefinition:
      "Factor regression explains how much of a security’s movement is driven by market, growth, defensive, or other factors. It reveals diversification value and whether a stock behaves like a pure-play exposure or a blend of themes.",
    category: "Factor model",
  },
  {
    id: "price-chart",
    term: "Price history",
    shortDefinition:
      "Closing prices over the selected range with annotations for gaps and volume spikes.",
    longDefinition:
      "The primary chart contextualises recent performance, highlights abnormal events (gap opens, volume spikes), and serves as the anchor for most other metrics shown in the dashboard.",
    category: "Overview",
  },
  {
    id: "event-detection",
    term: "Event detection",
    shortDefinition:
      "Highlights gap openings, volume spikes, and the largest daily moves.",
    longDefinition:
      "Automatically surfaces days where price action or volume deviated significantly from the norm. Use it to quickly drill into catalysts or confirm whether returns were accompanied by participation.",
    category: "Overview",
  },
  {
    id: "risk-cards",
    term: "Risk & return cards",
    shortDefinition:
      "Snapshot of last close, trailing returns, and annualised volatility.",
    longDefinition:
      "These cards provide a high-level summary before diving into the detailed analytics. They help answer “what has price done lately?” and “how volatile has it been?” at a glance.",
    category: "Overview",
  },
  {
    id: "trend-signals",
    term: "Trend signals",
    shortDefinition:
      "Moving averages, RSI, and MACD used to classify regimes and build strategies.",
    longDefinition:
      "This panel showcases the indicators feeding the regime detector and Strategy Lab. It clarifies whether the asset is trending, mean-reverting, or in transition.",
    category: "Strategy",
  },
  {
    id: "regime-classification",
    term: "Regime classification",
    shortDefinition:
      "Timeline showing which regime (uptrend, downtrend, sideways, high-vol) each day belonged to.",
    longDefinition:
      "Regime awareness helps interpret strategy results and design conditional filters (e.g., only trade in uptrends). The classification uses MA spreads, RSI, and realised volatility thresholds.",
    category: "Strategy",
  },
  {
    id: "momentum",
    term: "Momentum oscillators",
    shortDefinition:
      "RSI and MACD charts signalling overbought/oversold or momentum shifts.",
    longDefinition:
      "Oscillators complement trend signals by showing when momentum is stretched or diverging. They are particularly useful for spotting potential reversals.",
    category: "Strategy",
  },
  {
    id: "risk-tail",
    term: "VaR & Expected Shortfall",
    shortDefinition:
      "Tail-risk dashboard comparing historical vs. parametric estimates for VaR and ES.",
    longDefinition:
      "Combines non-parametric (historical) and parametric (normal) methods so you can judge tail sensitivity. Also clarifies how assumptions affect the reported risk numbers.",
    category: "Risk",
  },
  {
    id: "serial-dependence",
    term: "Serial dependence",
    shortDefinition:
      "Autocorrelation and Ljung–Box tests on returns and absolute returns.",
    longDefinition:
      "Detects momentum/mean-reversion (return autocorrelation) and volatility clustering (absolute-return autocorrelation). Significant lags reveal opportunities or model violations.",
    category: "Time series",
  },
  {
    id: "seasonality",
    term: "Seasonality",
    shortDefinition:
      "Day-of-week and month-of-year average returns with sample counts.",
    longDefinition:
      "Identifying recurring calendar effects can inform timing decisions, though small sample sizes warrant caution.",
    category: "Time series",
  },
  {
    id: "screener",
    term: "Screener & ranking",
    shortDefinition:
      "Ranks the NASDAQ universe by momentum, volatility, and Sharpe.",
    longDefinition:
      "A convenient way to scan leaders, laggards, or candidates with specific risk/return traits. Results can be exported for deeper due diligence.",
    category: "Cross-section",
  },
  {
    id: "risk-model",
    term: "Risk model (PCA)",
    shortDefinition:
      "PCA-based decomposition of cross-sectional returns and factor loadings.",
    longDefinition:
      "Highlights dominant latent factors so you can monitor common drivers across the watchlist. Useful for gauging concentration risk.",
    category: "Risk model",
  },
  {
    id: "forecast",
    term: "Price forecast",
    shortDefinition:
      "Baseline projections using naïve, rolling-mean, or EWMA models.",
    longDefinition:
      "Illustrates how simple statistical assumptions propagate into forward-looking price envelopes. Not a recommendation—purely educational.",
    category: "Forecasting",
  },
  {
    id: "advanced-analytics",
    term: "Rolling analytics",
    shortDefinition:
      "21/63-day rolling volatility, returns, and drawdown series.",
    longDefinition:
      "Rolling metrics reveal how risk evolves through time instead of relying on single-period averages. They help contextualise whether current conditions are calm or turbulent relative to history.",
    category: "Risk",
  },
  {
    id: "multi-comparison",
    term: "Multi-stock comparison",
    shortDefinition:
      "Normalised performance chart for comparing multiple tickers on the same scale.",
    longDefinition:
      "Rebasing each ticker to 1 at the range start exposes relative outperformance and correlation patterns without getting distracted by nominal prices.",
    category: "Portfolio",
  },
  {
    id: "correlation-matrix",
    term: "Correlation matrix",
    shortDefinition:
      "Pairwise correlation heatmap for the selected symbols.",
    longDefinition:
      "Helps identify diversification opportunities (low/negative correlations) and clusters of assets that move together.",
    category: "Portfolio",
  },
  {
    id: "equal-weight-portfolio",
    term: "Equal-weight portfolio",
    shortDefinition:
      "Simulated basket that allocates equally across the selected symbols.",
    longDefinition:
      "Provides a baseline diversified portfolio for comparison. We compute equity curve, return, volatility, Sharpe, and drawdown so you can evaluate whether custom weightings add value.",
    category: "Portfolio",
  },
  {
    id: "rolling-correlations",
    term: "Rolling correlations",
    shortDefinition:
      "Correlations between a reference ticker and peers across different windows.",
    longDefinition:
      "Shows whether diversification benefits are stable or regime-dependent. Falling correlations can signal improving diversification; rising correlations warn of convergence.",
    category: "Portfolio",
  },
];

const ENTRY_MAP = new Map<string, GlossaryEntry>(
  GLOSSARY_ENTRIES.map((entry) => [entry.id, entry]),
);

export function findGlossaryEntry(id: string): GlossaryEntry | undefined {
  return ENTRY_MAP.get(id);
}

export type GlossaryTermId = (typeof GLOSSARY_ENTRIES)[number]["id"];
