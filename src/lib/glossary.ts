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
      "Standard deviation of daily log returns – the typical day-to-day move.",
    longDefinition:
      "Daily volatility measures the dispersion of log returns around their mean. It is computed as the sample standard deviation over the selected range and is the foundation for annualised risk metrics.",
    category: "Risk",
    formulaLatex: "\\sigma_{daily} = \\sqrt{\\frac{1}{N-1}\\sum (r_t-\\bar r)^2}",
  },
  {
    id: "volatility_annualised",
    term: "Annualised volatility",
    shortDefinition:
      "Daily volatility scaled by √252 to express risk per trading year.",
    longDefinition:
      "Annualised volatility extrapolates the observed daily dispersion to a one-year horizon under the assumption of i.i.d. daily returns. It is widely used to quote risk budgets or compare assets with different trading frequencies.",
    category: "Risk",
    formulaLatex: "\\sigma_{annual} = \\sigma_{daily} \\sqrt{252}",
  },
  {
    id: "sharpe_ratio",
    term: "Sharpe ratio",
    shortDefinition:
      "Risk-adjusted return: excess return per unit of annualised volatility.",
    longDefinition:
      "The Sharpe ratio divides annualised excess return (asset return minus risk-free rate) by annualised volatility. Higher values indicate more reward for each unit of risk. Negative values imply underperformance relative to the risk-free rate.",
    category: "Performance",
    formulaLatex: "S = \\frac{\\mu_{annual} - r_f}{\\sigma_{annual}}",
  },
  {
    id: "value_at_risk",
    term: "Value-at-Risk (VaR)",
    shortDefinition:
      "Loss threshold not expected to be breached with a chosen confidence.",
    longDefinition:
      "VaR answers: \"What is the maximum expected loss over the horizon at confidence α?\" Historical VaR sorts realised returns, whereas the parametric version assumes normality.",
    category: "Risk",
    formulaLatex: "VaR_{\\alpha} = \\inf\\{x : P(Loss > x) \\le 1-\\alpha\\}",
  },
  {
    id: "expected_shortfall",
    term: "Expected Shortfall (ES)",
    shortDefinition:
      "Average loss beyond the VaR threshold (also called CVaR).",
    longDefinition:
      "Expected Shortfall captures tail severity by averaging all outcomes that exceed VaR. Because it incorporates the entire tail, it is more stable and coherent than VaR.",
    category: "Risk",
    formulaLatex:
      "ES_{\\alpha} = E[Loss \\mid Loss > VaR_{\\alpha}]",
  },
  {
    id: "max_drawdown",
    term: "Maximum drawdown",
    shortDefinition: "Largest peak-to-trough decline observed over the range.",
    longDefinition:
      "Max drawdown tracks the worst percentage fall from a running equity peak. It highlights path-dependent losses and complements volatility when assessing downside risk.",
    category: "Risk",
  },
  {
    id: "total_return",
    term: "Total return",
    shortDefinition:
      "Percent change from the first to the last value of the series.",
    longDefinition:
      "Total return shows the cumulative simple return over the selected period. For portfolios it assumes continuous compounding of the simulated equity curve.",
    category: "Performance",
    formulaLatex: "R_{tot} = \\frac{P_{end}}{P_{start}} - 1",
  },
  {
    id: "trailing_return",
    term: "Trailing return",
    shortDefinition:
      "Simple return over a fixed lookback window (e.g. 1 month).",
    longDefinition:
      "Trailing returns compare today’s close with the close n trading days ago to provide quick momentum snapshots (1M, 3M, etc.). They ignore path but highlight recent performance.",
    category: "Performance",
    formulaLatex: "R_{n} = \\frac{P_t}{P_{t-n}} - 1",
  },
  {
    id: "last_close",
    term: "Last close",
    shortDefinition:
      "Most recent traded closing price for the selected symbol.",
    longDefinition:
      "The dashboard always anchors statistics to the latest available closing price. Currency formatting follows the security’s home market.",
    category: "Overview",
  },
  {
    id: "mean_daily_return",
    term: "Mean daily return",
    shortDefinition: "Average of daily log returns over the sample.",
    longDefinition:
      "A simple arithmetic mean of daily log returns; it approximates the expected daily drift and feeds into annualised statistics.",
    category: "Performance",
  },
  {
    id: "mean_annual_return",
    term: "Annualised mean return",
    shortDefinition:
      "Daily mean scaled by the number of trading days in a year.",
    longDefinition:
      "Annual mean return = daily mean × 252. It represents the expected compound growth rate if the average daily drift persisted for an entire trading year.",
    category: "Performance",
    formulaLatex: "\\mu_{annual} = \\mu_{daily} \\times 252",
  },
  {
    id: "skewness",
    term: "Skewness",
    shortDefinition:
      "Measures asymmetry of the return distribution (left vs right tail).",
    longDefinition:
      "Negative skew indicates occasional large losses (fat left tail), while positive skew means outsized gains. Many equity strategies exhibit negative skew because of crash risk.",
    category: "Risk",
  },
  {
    id: "kurtosis",
    term: "Excess kurtosis",
    shortDefinition:
      "Compares tail heaviness to a normal distribution (kurtosis − 3).",
    longDefinition:
      "Positive excess kurtosis signals fat tails and a higher probability of extreme events. Negative values indicate thinner tails than the normal distribution.",
    category: "Risk",
  },
  {
    id: "beta",
    term: "Beta",
    shortDefinition:
      "Sensitivity of the asset to benchmark returns (slope of CAPM regression).",
    longDefinition:
      "Beta quantifies how much the asset moves relative to the benchmark. Values above 1 imply amplified market swings; negative betas move in the opposite direction.",
    category: "Factor model",
    formulaLatex: "\\beta = \\frac{Cov(r_i, r_m)}{Var(r_m)}",
  },
  {
    id: "alpha_daily",
    term: "Alpha (daily)",
    shortDefinition: "Average daily excess return unexplained by beta.",
    longDefinition:
      "Daily alpha is the intercept of the CAPM regression. Positive alpha suggests idiosyncratic outperformance beyond market moves.",
    category: "Factor model",
  },
  {
    id: "alpha_annual",
    term: "Alpha (annualised)",
    shortDefinition:
      "Annualised intercept of the CAPM regression (daily alpha × 252).",
    longDefinition:
      "Annual alpha expresses the same unexplained return advantage but scaled to a year, making it comparable to long-term performance targets.",
    category: "Factor model",
    formulaLatex: "\\alpha_{annual} = (1 + \\alpha_{daily})^{252} - 1",
  },
  {
    id: "r_squared",
    term: "R²",
    shortDefinition:
      "Proportion of return variance explained by the benchmark regression.",
    longDefinition:
      "R² close to 1 means the benchmark accounts for most movements; low R² indicates idiosyncratic behavior.",
    category: "Factor model",
  },
  {
    id: "pca",
    term: "Principal Component Analysis (PCA)",
    shortDefinition:
      "Decomposes correlated returns into orthogonal risk factors.",
    longDefinition:
      "PCA diagonalises the covariance matrix of cross-sectional returns. The top eigenvectors describe dominant risk themes like market beta or sector tilts.",
    category: "Risk model",
  },
  {
    id: "scenario_analysis",
    term: "Shock scenario",
    shortDefinition:
      "Applies an instantaneous return shock to current equity to test resilience.",
    longDefinition:
      "Scenario analysis converts a hypothetical price move (e.g., −5%) into a new equity value so you can gauge the immediate impact of stress events.",
    category: "Stress testing",
  },
  {
    id: "monte_carlo",
    term: "Monte Carlo simulation",
    shortDefinition:
      "Projects many geometric Brownian motion paths using historical drift and volatility.",
    longDefinition:
      "Monte Carlo paths randomly sample shocks to illustrate the distribution of potential future equity values over a chosen horizon. Each path compounds log returns drawn from N(µ, σ).",
    category: "Stress testing",
  },
  {
    id: "portfolio_optimization",
    term: "Mean–variance optimisation",
    shortDefinition:
      "Searches for weights that balance expected return against volatility.",
    longDefinition:
      "The efficient frontier is built by sampling long-only weight vectors, computing portfolio mean/variance, and highlighting minimum-volatility and maximum-Sharpe portfolios.",
    category: "Portfolio",
  },
  {
    id: "price-chart",
    term: "Price history",
    shortDefinition:
      "Closing prices over the selected range with annotations for gaps and volume spikes.",
    longDefinition:
      "Helps follow regime shifts, breakout levels, and contextual events such as abnormal volume or overnight gaps.",
    category: "Overview",
  },
  {
    id: "event-detection",
    term: "Event detection",
    shortDefinition:
      "Flags gap openings, volume spikes, and the biggest single-day moves.",
    longDefinition:
      "Gap = open vs prior close; volume spike = z-score vs trailing mean. Use these events to investigate catalysts.",
    category: "Overview",
  },
  {
    id: "risk-cards",
    term: "Risk & return cards",
    shortDefinition:
      "Quick glance at trailing returns and annualised volatility.",
    longDefinition:
      "Summaries of last close, 1M/3M returns, and volatility show recent direction and dispersion before diving deeper.",
    category: "Overview",
  },
  {
    id: "trend-signals",
    term: "Trend signals",
    shortDefinition:
      "Compares fast vs. slow moving averages to spot golden/death crosses.",
    longDefinition:
      "Moving-average crossovers plus RSI help decide whether momentum favours bulls or bears.",
    category: "Price action",
  },
  {
    id: "regime-classification",
    term: "Regime classification",
    shortDefinition:
      "Labels each day as uptrend, downtrend, sideways, or high-volatility.",
    longDefinition:
      "Combines moving averages, RSI, and realised volatility to contextualise market states.",
    category: "Price action",
  },
  {
    id: "momentum",
    term: "Momentum oscillators",
    shortDefinition:
      "RSI and MACD diagnose overbought/oversold and momentum shifts.",
    longDefinition:
      "RSI compares average gains vs losses; MACD looks at the spread between fast and slow exponential averages. Crossovers often precede trend shifts.",
    category: "Price action",
  },
  {
    id: "return-distribution",
    term: "Return distribution",
    shortDefinition:
      "Histogram of daily log returns for spotting skewness and fat tails.",
    longDefinition:
      "Buckets returns into evenly spaced bins; tall tails or asymmetric bins hint at non-normal behaviour.",
    category: "Risk",
  },
  {
    id: "capm",
    term: "CAPM regression",
    shortDefinition:
      "Ordinary least squares regression of asset returns on benchmark returns.",
    longDefinition:
      "The CAPM view summarises market sensitivity (beta), unexplained outperformance (alpha), and fit (R²). It requires overlapping daily history between the asset and benchmark.",
    category: "Factor model",
  },
  {
    id: "risk-profile",
    term: "Risk profile",
    shortDefinition:
      "Summarises moments (mean, volatility, skew, kurtosis) and Sharpe.",
    longDefinition:
      "Pairs descriptive statistics with risk-adjusted return to provide a holistic read on distribution shape.",
    category: "Risk",
  },
  {
    id: "risk-tail",
    term: "Tail risk (VaR & ES)",
    shortDefinition:
      "Displays historical vs parametric VaR/ES for the chosen horizon.",
    longDefinition:
      "Historical estimation replays realised returns; the normal approximation assumes iid Gaussian log returns for faster what-if analysis.",
    category: "Risk",
  },
  {
    id: "serial-dependence",
    term: "Serial dependence",
    shortDefinition:
      "Autocorrelation (ACF) and Ljung–Box tests for returns and |returns|.",
    longDefinition:
      "Detects momentum/mean-reversion and volatility clustering by inspecting correlations across lags.",
    category: "Time series",
  },
  {
    id: "seasonality",
    term: "Seasonality",
    shortDefinition:
      "Day-of-week and month-of-year average returns with sample counts.",
    longDefinition:
      "Calendar patterns sometimes hint at behavioural biases; low sample counts signal weak evidence.",
    category: "Time series",
  },
  {
    id: "advanced-analytics",
    term: "Rolling analytics",
    shortDefinition:
      "21/63-day rolling volatility, returns, and drawdown series.",
    longDefinition:
      "Rolling windows reveal how risk evolved over time instead of relying on a single full-period number.",
    category: "Time series",
  },
  {
    id: "multi-comparison",
    term: "Multi-stock comparison",
    shortDefinition:
      "Normalises selected tickers to 1 at the range start for apple-to-apple comparisons.",
    longDefinition:
      "Great for spotting relative winners/laggards without worrying about nominal price levels.",
    category: "Portfolio",
  },
  {
    id: "correlation-matrix",
    term: "Correlation matrix",
    shortDefinition:
      "Pairwise daily-return correlations showing diversification potential.",
    longDefinition:
      "Green cells suggest co-movement; red cells highlight hedges. Use it to choose lower-correlation combinations.",
    category: "Portfolio",
  },
  {
    id: "equal-weight-portfolio",
    term: "Equal-weight portfolio",
    shortDefinition:
      "Simulates investing equally across the selected tickers.",
    longDefinition:
      "Tracks equity curve, total return, volatility, Sharpe, and drawdown for a naïve diversified basket.",
    category: "Portfolio",
  },
  {
    id: "rolling-correlations",
    term: "Rolling correlations",
    shortDefinition:
      "Correlation between a reference ticker and others over moving windows.",
    longDefinition:
      "Useful for checking whether diversification benefits persist or fade across market regimes.",
    category: "Portfolio",
  },
  {
    id: "screener",
    term: "Screener & ranking",
    shortDefinition:
      "Ranks the NASDAQ universe by momentum, volatility, and Sharpe.",
    longDefinition:
      "Helps surface leaders/laggards and supports quick top-N exports for further research.",
    category: "Cross-section",
  },
  {
    id: "forecast",
    term: "Price forecast",
    shortDefinition:
      "Baseline naive, rolling-mean, and EWMA projections with envelopes.",
    longDefinition:
      "Educational models that illustrate how simple statistical assumptions translate into forward-looking ranges.",
    category: "Forecasting",
  },
  {
    id: "risk-model",
    term: "Risk model (PCA)",
    shortDefinition:
      "Cross-sectional PCA showing variance explained and loadings.",
    longDefinition:
      "Highlights dominant latent factors so you can reason about common drivers across the NASDAQ set.",
    category: "Risk model",
  },
  {
    id: "factor_exposures",
    term: "Factor exposures",
    shortDefinition:
      "OLS regression of asset returns on proxy factors (market, growth, defensive).",
    longDefinition:
      "Coefficients (betas) measure co-movement with each factor, while the residual standard deviation captures idiosyncratic risk.",
    category: "Factor model",
  },
];

export type GlossaryTermId = (typeof GLOSSARY_ENTRIES)[number]["id"];

const GLOSSARY_MAP = new Map<string, GlossaryEntry>(
  GLOSSARY_ENTRIES.map((entry) => [entry.id, entry]),
);

export function findGlossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY_MAP.get(id);
}
