import { NextResponse } from "next/server";

import { VALID_SYMBOLS } from "@/lib/stocks";
import type { StockTimeSeriesPoint } from "@/lib/types";
import {
  LSTMPredictor,
  type BacktestMetrics,
  type PredictionResult,
  type TrainingConfig,
  type TrainingMetrics,
} from "@/lib/ml/models/lstm";
import type {
  FeatureEngineeringContext,
  StockData,
} from "@/lib/ml/features/engineering";

export const runtime = "nodejs";

const MIN_SERIES_LENGTH = 120;
const store = new PredictorStore();

type ActionMode = "train" | "predict" | "backtest" | "full";

type PredictRequest = {
  symbol: string;
  mode?: ActionMode;
  horizon?: number;
  compareVersion?: string;
  forceRetrain?: boolean;
  series: StockTimeSeriesPoint[];
  context?: FeatureEngineeringContext;
  config?: TrainingConfig;
};

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

/**
 * POST /api/ml/predict
 *
 * Accepts raw OHLCV series, triggers training/prediction/backtests, and returns
 * prediction outputs alongside model diagnostics for the UI.
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse | ErrorResponse>> {
  try {
    const payload = (await request.json()) as Partial<PredictRequest>;
    const validationError = validatePayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const symbol = payload.symbol!.toUpperCase();
    const action = normalizeAction(payload.mode);
    const context = payload.context ?? {};
    const preparedSeries = normalizeSeries(payload.series!, symbol);
    const entry = store.get(symbol);
    const config: TrainingConfig = {
      ...payload.config,
      context,
    };

    let trainingMetrics: TrainingMetrics | undefined;
    const needsTraining =
      payload.forceRetrain ||
      action === "train" ||
      action === "full" ||
      entry.predictor.model === null;

    if (needsTraining) {
      trainingMetrics = await entry.predictor.train(preparedSeries, config);
      store.record(symbol, trainingMetrics);
    }

    let predictions: PredictionResult[] | undefined;
    if (action === "predict" || action === "full") {
      if (entry.predictor.model === null && !trainingMetrics) {
        trainingMetrics = await entry.predictor.train(preparedSeries, config);
        store.record(symbol, trainingMetrics);
      }

      predictions = [];
      for (const horizon of entry.predictor.supportedHorizons) {
        const result = await entry.predictor.predict(preparedSeries, horizon, {
          context,
          mcDropoutSamples: payload.config?.mcDropoutSamples,
        });
        predictions.push(result);
      }
    }

    let backtest: BacktestMetrics | undefined;
    if (action === "backtest" || action === "full") {
      if (entry.predictor.model === null && !trainingMetrics) {
        trainingMetrics = await entry.predictor.train(preparedSeries, config);
        store.record(symbol, trainingMetrics);
      }
      backtest = await entry.predictor.evaluateBacktest(preparedSeries, { context });
    }

    const versionHistory = store.history(symbol);
    const comparison = buildComparison(versionHistory, payload.compareVersion);

    const response: ApiResponse = {
      symbol,
      action,
      predictions,
      trainingMetrics,
      backtest,
      versionHistory,
      comparison,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error during ML prediction";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type ErrorResponse = { error: string };

class PredictorStore {
  private readonly entries = new Map<
    string,
    { predictor: LSTMPredictor; history: TrainingMetrics[] }
  >();

  get(symbol: string): { predictor: LSTMPredictor; history: TrainingMetrics[] } {
    const normalized = symbol.toUpperCase();
    let entry = this.entries.get(normalized);
    if (!entry) {
      entry = {
        predictor: new LSTMPredictor(),
        history: [],
      };
      this.entries.set(normalized, entry);
    }
    return entry;
  }

  record(symbol: string, metrics: TrainingMetrics): void {
    const entry = this.get(symbol);
    entry.history.unshift(metrics);
    entry.history = entry.history.slice(0, 5);
  }

  history(symbol: string): TrainingMetrics[] {
    const entry = this.entries.get(symbol.toUpperCase());
    return entry ? [...entry.history] : [];
  }
}

function validatePayload(payload: Partial<PredictRequest>): string | null {
  if (!payload.symbol) {
    return "Symbol is required";
  }

  if (!VALID_SYMBOLS.has(payload.symbol.toUpperCase())) {
    return "Symbol not allowed in this dashboard";
  }

  if (!Array.isArray(payload.series) || payload.series.length === 0) {
    return "Price series is required";
  }

  if (payload.series.length < MIN_SERIES_LENGTH) {
    return `Need at least ${MIN_SERIES_LENGTH} daily observations for training`;
  }

  return null;
}

function normalizeAction(mode?: ActionMode): ActionMode {
  if (!mode) {
    return "predict";
  }

  const allowed: ActionMode[] = ["train", "predict", "backtest", "full"];
  return allowed.includes(mode) ? mode : "predict";
}

function normalizeSeries(series: StockTimeSeriesPoint[], symbol: string): StockData[] {
  return series.map((point) => ({
    ...point,
    symbol,
    adjustedClose: Number.isFinite(point.adjustedClose)
      ? Number(point.adjustedClose)
      : Number(point.close),
    open: Number(point.open),
    high: Number(point.high),
    low: Number(point.low),
    close: Number(point.close),
    volume: Number(point.volume),
  }));
}

function buildComparison(
  history: TrainingMetrics[],
  requestedVersion?: string,
): VersionComparison | null {
  if (history.length === 0) {
    return null;
  }

  const primary = toSnapshot(history[0]);
  const challengerSource =
    history.find((entry) => entry.version === requestedVersion) ?? history[1];

  if (!challengerSource) {
    return { primary };
  }

  const challenger = toSnapshot(challengerSource);
  return {
    primary,
    challenger,
    deltas: {
      validationLoss: primary.validationLoss - challenger.validationLoss,
      sampleCount: primary.sampleCount - challenger.sampleCount,
    },
  };
}

function toSnapshot(metrics: TrainingMetrics): VersionSnapshot {
  return {
    version: metrics.version,
    validationLoss: metrics.validationLoss,
    sampleCount: metrics.sampleCount,
    finishedAt: metrics.finishedAt,
  };
}
