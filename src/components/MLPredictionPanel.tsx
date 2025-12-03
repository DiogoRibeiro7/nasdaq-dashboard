"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { StockTimeSeriesPoint } from "@/lib/types";
import type {
  BacktestMetrics,
  PredictionResult,
  TrainingMetrics,
} from "@/lib/ml/models/lstm";

type ActionMode = "train" | "predict" | "backtest" | "full";

type ApiResponse = {
  symbol: string;
  action: ActionMode;
  predictions?: PredictionResult[];
  trainingMetrics?: TrainingMetrics;
  backtest?: BacktestMetrics;
  versionHistory: TrainingMetrics[];
  comparison?: VersionComparison | null;
};

type VersionSnapshot = {
  version: string;
  validationLoss: number;
  sampleCount: number;
  finishedAt: string;
};

type VersionComparison = {
  primary: VersionSnapshot;
  challenger?: VersionSnapshot;
  deltas?: {
    validationLoss: number;
    sampleCount: number;
  };
};

type PanelState = {
  status: "idle" | "loading" | "success" | "error";
  error?: string;
  payload?: ApiResponse;
  updatedAt?: string;
};

export type MLPredictionPanelProps = {
  symbol: string;
  series: StockTimeSeriesPoint[];
  benchmarkSeries?: StockTimeSeriesPoint[];
  sectorSeries?: StockTimeSeriesPoint[];
  autoRefreshMs?: number;
};

const ACTIONS: { label: string; value: ActionMode; description: string }[] = [
  { label: "Predict", value: "predict", description: "Run inference with dropout bands" },
  { label: "Train", value: "train", description: "Retrain using walk-forward CV" },
  { label: "Backtest", value: "backtest", description: "Score recent period" },
  { label: "Full Cycle", value: "full", description: "Train + predict + backtest" },
];

const formatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function MLPredictionPanel({
  symbol,
  series,
  benchmarkSeries,
  sectorSeries,
  autoRefreshMs = 60_000,
}: MLPredictionPanelProps): JSX.Element {
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const [primaryVersion, setPrimaryVersion] = useState<string | undefined>();
  const [challengerVersion, setChallengerVersion] = useState<string | undefined>();

  const payloadBase = useMemo(
    () => ({
      symbol,
      series,
      context: {
        benchmarkSeries,
        sectorSeries,
      },
      config: {
        bayesianTrials: 4,
        walkForwardSteps: 3,
        mcDropoutSamples: 80,
      },
    }),
    [symbol, series, benchmarkSeries, sectorSeries],
  );

  const triggerRequest = useCallback(
    async (mode: ActionMode = "predict") => {
      setState((prev) => ({
        ...prev,
        status: "loading",
        error: undefined,
      }));

      try {
        const response = await fetch("/api/ml/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payloadBase, mode }),
        });

        if (!response.ok) {
          const payload = (await safeJson(response)) as { error?: string };
          throw new Error(payload?.error ?? "Unable to complete ML request");
        }

        const data = (await response.json()) as ApiResponse;
        setState({
          status: "success",
          payload: data,
          updatedAt: new Date().toISOString(),
        });
        setPrimaryVersion((prev) => prev ?? data.versionHistory?.[0]?.version);
        setChallengerVersion(
          (prev) => prev ?? data.versionHistory?.[1]?.version ?? data.versionHistory?.[0]?.version,
        );
      } catch (error) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      }
    },
    [payloadBase],
  );

  useEffect(() => {
    triggerRequest("predict");
  }, [triggerRequest]);

  useEffect(() => {
    if (!autoRefreshMs) {
      return;
    }
    const id = setInterval(() => triggerRequest("predict"), autoRefreshMs);
    return () => clearInterval(id);
  }, [autoRefreshMs, triggerRequest]);

  const confidenceData = useMemo(() => {
    return (
      state.payload?.predictions?.map((prediction) => ({
        horizon: `${prediction.horizon}d`,
        lower: prediction.lower,
        range: prediction.upper - prediction.lower,
        mean: prediction.pointEstimate,
      })) ?? []
    );
  }, [state.payload?.predictions]);

  const featureImportance = useMemo(
    () => state.payload?.predictions?.[0]?.featureImportance?.slice(0, 8) ?? [],
    [state.payload?.predictions],
  );

  const explanation = useMemo(() => {
    if (!featureImportance.length) {
      return "Feature attribution will appear once training produces a valid model.";
    }
    const leaders = featureImportance.slice(0, 3).map((entry) => entry.feature);
    return `Forecasts lean the most on ${leaders.join(", ")} with dropout sampling providing calibrated uncertainty bands. Monitor these drivers for shifts before trusting the signal.`;
  }, [featureImportance]);

  const abComparison = useMemo(() => {
    const history = state.payload?.versionHistory ?? [];
    const map = new Map(history.map((entry) => [entry.version, entry]));
    const primary =
      map.get(primaryVersion ?? history[0]?.version) ?? history[0] ?? undefined;
    const challenger =
      map.get(challengerVersion ?? history[1]?.version) ??
      (primary && history.find((entry) => entry.version !== primary.version));

    if (!primary) {
      return null;
    }

    const snapshot = (entry: TrainingMetrics): VersionSnapshot => ({
      version: entry.version,
      validationLoss: entry.validationLoss,
      sampleCount: entry.sampleCount,
      finishedAt: entry.finishedAt,
    });

    const base = {
      primary: snapshot(primary),
      challenger: challenger ? snapshot(challenger) : undefined,
    };

    if (!base.challenger) {
      return base;
    }

    return {
      ...base,
      deltas: {
        validationLoss:
          base.primary.validationLoss - base.challenger.validationLoss,
        sampleCount: base.primary.sampleCount - base.challenger.sampleCount,
      },
    };
  }, [state.payload?.versionHistory, primaryVersion, challengerVersion]);

  const performanceCards = useMemo(() => {
    const training = state.payload?.trainingMetrics;
    const backtest = state.payload?.backtest;
    return [
      {
        label: "Validation Loss",
        value: formatNumber(training?.validationLoss),
        helper: training
          ? `Observed on ${formatter.format(new Date(training.finishedAt))}`
          : "Run a training cycle to populate this metric.",
      },
      {
        label: "MAE (Backtest)",
        value: backtest ? formatNumber(backtest.overall.mae) : "—",
        helper: "Average absolute error across all horizons.",
      },
      {
        label: "RMSE (Backtest)",
        value: backtest ? formatNumber(backtest.overall.rmse) : "—",
        helper: "Root mean squared error for combined horizons.",
      },
      {
        label: "Directional Accuracy",
        value: backtest
          ? `${(backtest.overall.directionalAccuracy * 100).toFixed(1)}%`
          : "—",
        helper: "Share of forecasts with correct sign.",
      },
    ];
  }, [state.payload?.trainingMetrics, state.payload?.backtest]);

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">
            Neural Forecasts
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">
            LSTM Prediction Lab · {symbol}
          </h2>
          <p className="text-sm text-slate-500">
            Multi-horizon dropout ensembles with walk-forward validation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((action) => (
            <button
              key={action.value}
              type="button"
              onClick={() => triggerRequest(action.value)}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              disabled={state.status === "loading"}
              title={action.description}
            >
              {action.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-4 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Status:{" "}
          <strong className="text-slate-800">
            {state.status === "loading" ? "Running inference..." : state.status}
          </strong>
        </span>
        {state.updatedAt && (
          <span>
            Last update: {formatter.format(new Date(state.updatedAt))}
          </span>
        )}
      </div>

      {state.error && (
        <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">
              Confidence Bands
            </h3>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Dropout MC
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={confidenceData}>
                <defs>
                  <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="horizon" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => `${(value * 100).toFixed(1)}%`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12 }}
                  formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stackId="bands"
                  stroke="transparent"
                  fill="transparent"
                  activeDot={false}
                />
                <Area
                  type="monotone"
                  dataKey="range"
                  stackId="bands"
                  stroke="#3b82f6"
                  fill="url(#band)"
                  name="Confidence Range"
                />
                <Line
                  type="monotone"
                  dataKey="mean"
                  stroke="#1d4ed8"
                  strokeWidth={2}
                  name="Mean"
                  dot={{ r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">
              Feature Importance
            </h3>
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Permutation
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={featureImportance.map((entry) => ({
                  ...entry,
                  scorePct: Number((entry.normalized * 100).toFixed(2)),
                }))}
                margin={{ left: 80 }}
              >
                <CartesianGrid horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={(value) => `${value}%`} stroke="#94a3b8" />
                <YAxis
                  dataKey="feature"
                  type="category"
                  width={100}
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Bar
                  dataKey="scorePct"
                  fill="#f97316"
                  radius={[4, 4, 4, 4]}
                  name="Contribution"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {performanceCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-100 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-1 text-xs text-slate-500">{card.helper}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 p-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-800">
              A/B Test · Model Versions
            </h3>
            <p className="text-sm text-slate-500">
              Compare validation loss and sample depth across model checkpoints.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 flex-col text-sm text-slate-600">
              Control
              <select
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                value={primaryVersion ?? ""}
                onChange={(event) => setPrimaryVersion(event.target.value)}
              >
                {(state.payload?.versionHistory ?? []).map((entry) => (
                  <option key={entry.version} value={entry.version}>
                    {entry.version}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col text-sm text-slate-600">
              Challenger
              <select
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                value={challengerVersion ?? ""}
                onChange={(event) => setChallengerVersion(event.target.value)}
              >
                {(state.payload?.versionHistory ?? []).map((entry) => (
                  <option key={entry.version} value={entry.version}>
                    {entry.version}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Version</th>
                  <th className="px-3 py-2 text-right">Val Loss</th>
                  <th className="px-3 py-2 text-right">Samples</th>
                </tr>
              </thead>
              <tbody>
                {abComparison?.primary && (
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {abComparison.primary.version} (control)
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(abComparison.primary.validationLoss)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {abComparison.primary.sampleCount}
                    </td>
                  </tr>
                )}
                {abComparison?.challenger && (
                  <tr className="border-t border-slate-100 bg-slate-50/60">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {abComparison.challenger.version}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(abComparison.challenger.validationLoss)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {abComparison.challenger.sampleCount}
                    </td>
                  </tr>
                )}
                {abComparison?.deltas && (
                  <tr className="border-t border-slate-100 text-slate-600">
                    <td className="px-3 py-2 font-semibold">Δ Control - Challenger</td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(abComparison.deltas.validationLoss)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {abComparison.deltas.sampleCount}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 p-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-800">Model Narrative</h3>
            <p className="text-sm text-slate-500">
              Human-readable explanation of the signal drivers and uncertainty.
            </p>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">{explanation}</p>
          {state.payload?.backtest && (
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              {state.payload.backtest.horizonStats &&
                Object.entries(state.payload.backtest.horizonStats).map(([key, stats]) => (
                  <div key={key}>
                    <p className="font-semibold text-slate-800">{key} day</p>
                    <p>MAE: {formatNumber(stats.mae)}</p>
                    <p>RMSE: {formatNumber(stats.rmse)}</p>
                    <p>Hit: {(stats.directionalAccuracy * 100).toFixed(1)}%</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatNumber(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  if (Math.abs(value) >= 1) {
    return value.toFixed(2);
  }
  return value.toPrecision(2);
}
