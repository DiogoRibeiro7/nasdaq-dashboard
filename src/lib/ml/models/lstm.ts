import * as tf from "@tensorflow/tfjs";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  FeatureEngineeringPipeline,
  type FeatureEngineeringContext,
  type FeatureEngineeringOptions,
  type FeatureImportance,
  type StockData,
} from "@/lib/ml/features/engineering";
import { StandardScaler } from "@/lib/ml/preprocessing/scaler";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PredictionResult = {
  horizon: number;
  pointEstimate: number;
  lower: number;
  upper: number;
  samples: number[];
  version: string | null;
  updatedAt: string;
  featureImportance: FeatureImportance[];
};

export type BacktestMetrics = {
  sampleCount: number;
  startDate?: string;
  endDate?: string;
  horizonStats: Record<
    number,
    {
      mae: number;
      rmse: number;
      directionalAccuracy: number;
    }
  >;
  overall: {
    mae: number;
    rmse: number;
    directionalAccuracy: number;
  };
};

export type TrainingMetrics = {
  version: string;
  finishedAt: string;
  hyperParams: HyperParams;
  trials: TrialRecord[];
  walkForward: WalkForwardSummary[];
  validationLoss: number;
  featureImportance: FeatureImportance[];
  sampleCount: number;
};

export type TrainingConfig = {
  epochs?: number;
  batchSize?: number;
  patience?: number;
  bayesianTrials?: number;
  walkForwardSteps?: number;
  validationSize?: number;
  minTrainSize?: number;
  learningRateRange?: [number, number];
  dropoutRange?: [number, number];
  hiddenUnitsRange?: [number, number];
  l2Range?: [number, number];
  mcDropoutSamples?: number;
  seed?: number;
  context?: FeatureEngineeringContext;
};

type HyperParams = {
  learningRate: number;
  dropoutRate: number;
  hiddenUnits: [number, number];
  l2: number;
};

type WalkForwardWindow = {
  trainStart: number;
  trainEnd: number;
  valStart: number;
  valEnd: number;
  label: string;
};

type WalkForwardSummary = {
  window: string;
  validationLoss: number;
  epochsRun: number;
  samples: number;
};

type TrialRecord = {
  params: HyperParams;
  loss: number;
  timestamp: string;
  windowMetrics: WalkForwardSummary[];
};

type SequenceDataset = {
  features: number[][][];
  targets: number[][];
  dates: string[];
};

export type PredictionOptions = {
  context?: FeatureEngineeringContext;
  mcDropoutSamples?: number;
};

export type BacktestOptions = {
  context?: FeatureEngineeringContext;
};

type PredictorOptions = {
  sequenceLength?: number;
  horizons?: number[];
  featureOptions?: FeatureEngineeringOptions;
  scaler?: StandardScaler;
  mcDropoutSamples?: number;
};

export interface LSTMPredictor {
  model: tf.LayersModel | null;
  scaler: StandardScaler;
  featureNames: string[];
  readonly supportedHorizons: number[];

  train(data: StockData[], config?: TrainingConfig): Promise<TrainingMetrics>;
  predict(
    currentData: StockData[],
    horizon: number,
    options?: PredictionOptions,
  ): Promise<PredictionResult>;
  evaluateBacktest(
    testData: StockData[],
    options?: BacktestOptions,
  ): Promise<BacktestMetrics>;
  exportModel(path: string): Promise<void>;
}

/**
 * Experiment tracker keeps an in-memory history of versions for diagnostics.
 */
class ExperimentTracker {
  private readonly records: ModelVersionRecord[] = [];

  log(record: ModelVersionRecord): void {
    this.records.push(record);
  }

  latest(): ModelVersionRecord | null {
    return this.records[this.records.length - 1] ?? null;
  }

  history(): ModelVersionRecord[] {
    return [...this.records];
  }
}

type ModelVersionRecord = {
  version: string;
  timestamp: string;
  metrics: TrainingMetrics;
  hyperParams: HyperParams;
};

// ─────────────────────────────────────────────────────────────────────────────
// Predictor Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class LSTMPredictor implements LSTMPredictor {
  public model: tf.LayersModel | null = null;
  public scaler: StandardScaler;
  public featureNames: string[] = [];

  private readonly sequenceLength: number;
  private readonly horizons: number[];
  private readonly pipeline: FeatureEngineeringPipeline;
  private readonly tracker = new ExperimentTracker();
  private readonly defaultMcSamples: number;
  private featureImportance: FeatureImportance[] = [];
  private currentVersion: string | null = null;

  constructor(options: PredictorOptions = {}) {
    this.sequenceLength = options.sequenceLength ?? 60;
    this.horizons = options.horizons ?? [1, 5, 10, 20];
    this.pipeline = new FeatureEngineeringPipeline(options.featureOptions);
    this.scaler = options.scaler ?? new StandardScaler();
    this.defaultMcSamples = options.mcDropoutSamples ?? 50;
  }

  /**
   * Returns the forecast horizons supported by the model instance.
   */
  get supportedHorizons(): number[] {
    return [...this.horizons];
  }

  /**
   * Trains the predictor via walk-forward validation and Bayesian search.
   */
  async train(
    data: StockData[],
    config: TrainingConfig = {},
  ): Promise<TrainingMetrics> {
    const engineered = this.pipeline.transform(data, config.context);
    this.featureNames = engineered.featureNames;

    const scaledFeatures = this.scaler.fitTransform(engineered.featureMatrix);
    const dataset = this.buildSequences(
      scaledFeatures,
      engineered.targetMatrix,
      engineered.dates,
    );

    if (dataset.features.length === 0) {
      throw new Error("LSTMPredictor: not enough samples after sequencing");
    }

    const windows = this.createWalkForwardWindows(
      dataset.features.length,
      config.validationSize,
      config.walkForwardSteps,
      config.minTrainSize,
    );

    const trials = await this.runBayesianSearch(dataset, windows, config);
    if (trials.length === 0) {
      throw new Error("LSTMPredictor: failed to complete Bayesian search");
    }

    const bestTrial = trials.reduce((best, trial) =>
      trial.loss < best.loss ? trial : best,
    );

    const finalModelResult = await this.trainFinalModel(
      dataset,
      config,
      bestTrial.params,
    );

    this.model?.dispose?.();
    this.model = finalModelResult.model;
    this.featureImportance = await this.estimateFeatureImportance(dataset);
    this.currentVersion = `lstm-${Date.now()}`;

    const metrics: TrainingMetrics = {
      version: this.currentVersion,
      finishedAt: new Date().toISOString(),
      hyperParams: bestTrial.params,
      trials,
      walkForward: bestTrial.windowMetrics,
      validationLoss: finalModelResult.bestValLoss,
      featureImportance: this.featureImportance,
      sampleCount: dataset.features.length,
    };

    this.tracker.log({
      version: this.currentVersion,
      timestamp: metrics.finishedAt,
      metrics,
      hyperParams: bestTrial.params,
    });

    return metrics;
  }

  /**
   * Generates probabilistic forecasts via Monte Carlo dropout.
   */
  async predict(
    currentData: StockData[],
    horizon: number,
    options: PredictionOptions = {},
  ): Promise<PredictionResult> {
    if (!this.model) {
      throw new Error("LSTMPredictor: model is not trained");
    }

    const mcSamples = options.mcDropoutSamples ?? this.defaultMcSamples;
    const engineered = this.pipeline.transform(currentData, options.context);
    const scaledFeatures = this.scaler.transform(engineered.featureMatrix);
    const sequence = this.extractLatestSequence(
      scaledFeatures,
      engineered.targetMatrix,
    );

    if (!sequence) {
      throw new Error(
        "LSTMPredictor: unable to build the latest sequence for prediction",
      );
    }

    const horizonIndex = this.horizons.indexOf(horizon);
    if (horizonIndex === -1) {
      throw new Error(`LSTMPredictor: unsupported horizon ${horizon}`);
    }

    const inputTensor = tf.tensor(sequence, [
      1,
      this.sequenceLength,
      this.featureNames.length,
    ]);

    const samples: number[] = [];
    for (let i = 0; i < Math.max(mcSamples, 1); i += 1) {
      const output = tf.tidy(() =>
        this.model!.apply(inputTensor, {
          training: true,
        }) as tf.Tensor,
      );
      const array = (await output.array()) as number[][];
      samples.push(array[0][horizonIndex]);
      output.dispose();
    }

    inputTensor.dispose();

    const mean =
      samples.reduce((acc, value) => acc + value, 0) / samples.length || 0;
    const variance =
      samples.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
        Math.max(samples.length - 1, 1) || 0;
    const stdDev = Math.sqrt(variance);
    const interval = 1.96 * stdDev;

    return {
      horizon,
      pointEstimate: mean,
      lower: mean - interval,
      upper: mean + interval,
      samples,
      version: this.currentVersion,
      updatedAt: new Date().toISOString(),
      featureImportance: this.featureImportance,
    };
  }

  /**
   * Evaluates the trained model against hold-out data via walk-forward backtest.
   */
  async evaluateBacktest(
    testData: StockData[],
    options: BacktestOptions = {},
  ): Promise<BacktestMetrics> {
    if (!this.model) {
      throw new Error("LSTMPredictor: train the model before running backtests");
    }

    const engineered = this.pipeline.transform(testData, options.context);
    const scaledFeatures = this.scaler.transform(engineered.featureMatrix);
    const dataset = this.buildSequences(
      scaledFeatures,
      engineered.targetMatrix,
      engineered.dates,
    );

    if (dataset.features.length === 0) {
      throw new Error("LSTMPredictor: not enough samples for backtesting");
    }

    const horizonStats: BacktestMetrics["horizonStats"] = {};
    for (const horizon of this.horizons) {
      horizonStats[horizon] = { mae: 0, rmse: 0, directionalAccuracy: 0 };
    }

    const input = tf.tensor(dataset.features);
    const output = this.model!.predict(input) as tf.Tensor;
    const predictions = (await output.array()) as number[][];
    input.dispose();
    output.dispose();

    let totalMae = 0;
    let totalRmse = 0;
    let totalDirectional = 0;
    let count = 0;

    for (let i = 0; i < predictions.length; i += 1) {
      const predRow = predictions[i];
      const targetRow = dataset.targets[i];

      predRow.forEach((pred, idx) => {
        const target = targetRow[idx];
        const diff = pred - target;
        horizonStats[this.horizons[idx]].mae += Math.abs(diff);
        horizonStats[this.horizons[idx]].rmse += diff ** 2;
        horizonStats[this.horizons[idx]].directionalAccuracy +=
          Math.sign(pred) === Math.sign(target) ? 1 : 0;
      });

      const averageDiff =
        predRow.reduce((acc, value, idx) => acc + (value - targetRow[idx]), 0) /
        predRow.length;
      totalMae += Math.abs(averageDiff);
      totalRmse += averageDiff ** 2;
      totalDirectional += predRow.every(
        (_value, idx) =>
          Math.sign(predRow[idx]) === Math.sign(targetRow[idx]),
      )
        ? 1
        : 0;
      count += 1;
    }

    Object.entries(horizonStats).forEach(([horizonKey, stats]) => {
      stats.mae = stats.mae / Math.max(count, 1);
      stats.rmse = Math.sqrt(stats.rmse / Math.max(count, 1));
      stats.directionalAccuracy = stats.directionalAccuracy / Math.max(count, 1);
      horizonStats[Number(horizonKey)] = stats;
    });

    return {
      sampleCount: count,
      startDate: dataset.dates[0],
      endDate: dataset.dates[dataset.dates.length - 1],
      horizonStats,
      overall: {
        mae: totalMae / Math.max(count, 1),
        rmse: Math.sqrt(totalRmse / Math.max(count, 1)),
        directionalAccuracy: totalDirectional / Math.max(count, 1),
      },
    };
  }

  /**
   * Serializes the model, scaler, and metadata to disk.
   */
  async exportModel(destination: string): Promise<void> {
    if (!this.model) {
      throw new Error("LSTMPredictor: no trained model to export");
    }

    await fs.mkdir(destination, { recursive: true });

    const handler = tf.io.withSaveHandler(async (artifacts) => {
      const modelJsonPath = path.join(destination, "model.json");
      const weightsPath = path.join(destination, "weights.bin");
      const payload = {
        format: "layers-model",
        generatedBy: "tensorflowjs-layers v4",
        convertedBy: null,
        modelTopology: artifacts.modelTopology,
        weightsManifest: [
          {
            paths: ["./weights.bin"],
            weights: artifacts.weightSpecs ?? [],
          },
        ],
      };

      await fs.writeFile(modelJsonPath, JSON.stringify(payload, null, 2), "utf8");
      if (artifacts.weightData) {
        await fs.writeFile(weightsPath, Buffer.from(artifacts.weightData));
      }

      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: "JSON",
          modelTopologyBytes: JSON.stringify(payload.modelTopology ?? {}).length,
          weightSpecsBytes: JSON.stringify(payload.weightsManifest ?? []).length,
          weightDataBytes: artifacts.weightData
            ? (artifacts.weightData as ArrayBuffer).byteLength
            : 0,
        },
      };
    });

    await this.model.save(handler);
    await fs.writeFile(
      path.join(destination, "scaler.json"),
      JSON.stringify(this.scaler.toJSON(), null, 2),
      "utf8",
    );
    await fs.writeFile(
      path.join(destination, "metadata.json"),
      JSON.stringify(
        {
          featureNames: this.featureNames,
          horizons: this.horizons,
          version: this.currentVersion,
          exportedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────────────────────

  private buildSequences(
    features: number[][],
    targets: (number | null)[][],
    dates: string[],
  ): SequenceDataset {
    const sequences: number[][][] = [];
    const seqTargets: number[][] = [];
    const seqDates: string[] = [];

    for (let idx = this.sequenceLength - 1; idx < features.length; idx += 1) {
      const targetRow = targets[idx];
      if (targetRow.some((value) => value === null || !Number.isFinite(value))) {
        continue;
      }

      const sequence: number[][] = [];
      for (let offset = idx - this.sequenceLength + 1; offset <= idx; offset += 1) {
        sequence.push(features[offset]);
      }

      sequences.push(sequence);
      seqTargets.push(targetRow as number[]);
      seqDates.push(dates[idx]);
    }

    return { features: sequences, targets: seqTargets, dates: seqDates };
  }

  private extractLatestSequence(
    features: number[][],
    targets: (number | null)[][],
  ): number[][][] | null {
    if (features.length < this.sequenceLength) {
      return null;
    }

    const lastIdx = features.length - 1;
    const targetRow = targets[lastIdx];
    if (targetRow.some((value) => value === null)) {
      return null;
    }

    const sequence: number[][] = [];
    for (
      let offset = lastIdx - this.sequenceLength + 1;
      offset <= lastIdx;
      offset += 1
    ) {
      sequence.push(features[offset]);
    }
    return [sequence];
  }

  private createWalkForwardWindows(
    sampleCount: number,
    validationSize?: number,
    steps = 3,
    minTrainSize?: number,
  ): WalkForwardWindow[] {
    const valSize =
      validationSize ?? Math.max(20, Math.round(sampleCount * 0.1));
    const minTrain = Math.max(minTrainSize ?? this.sequenceLength * 2, valSize);
    const windows: WalkForwardWindow[] = [];

    let trainEnd = minTrain;
    let windowIndex = 1;
    while (trainEnd + valSize <= sampleCount && windows.length < (steps ?? 3)) {
      const valStart = trainEnd;
      const valEnd = valStart + valSize;
      windows.push({
        trainStart: 0,
        trainEnd,
        valStart,
        valEnd,
        label: `W${windowIndex}`,
      });
      trainEnd = valEnd;
      windowIndex += 1;
    }

    if (windows.length === 0) {
      windows.push({
        trainStart: 0,
        trainEnd: Math.max(sampleCount - valSize, this.sequenceLength),
        valStart: Math.max(sampleCount - valSize, this.sequenceLength),
        valEnd: sampleCount,
        label: "W1",
      });
    }

    return windows;
  }

  private async runBayesianSearch(
    dataset: SequenceDataset,
    windows: WalkForwardWindow[],
    config: TrainingConfig,
  ): Promise<TrialRecord[]> {
    const trials: TrialRecord[] = [];
    const attempts = config.bayesianTrials ?? 5;

    for (let i = 0; i < attempts; i += 1) {
      const params = this.suggestHyperParams(trials, config);
      const evaluation = await this.evaluateHyperParams(
        dataset,
        windows,
        config,
        params,
      );
      trials.push({
        params,
        loss: evaluation.loss,
        timestamp: new Date().toISOString(),
        windowMetrics: evaluation.windowMetrics,
      });
    }

    return trials.sort((a, b) => a.loss - b.loss);
  }

  private suggestHyperParams(
    trials: TrialRecord[],
    config: TrainingConfig,
  ): HyperParams {
    const [lrMin, lrMax] = config.learningRateRange ?? [1e-4, 5e-3];
    const [dropMin, dropMax] = config.dropoutRange ?? [0.1, 0.4];
    const [hiddenMin, hiddenMax] = config.hiddenUnitsRange ?? [32, 128];
    const [l2Min, l2Max] = config.l2Range ?? [1e-6, 1e-3];

    if (trials.length < 2) {
      return {
        learningRate: randomBetween(lrMin, lrMax),
        dropoutRate: randomBetween(dropMin, dropMax),
        hiddenUnits: [
          Math.round(randomBetween(hiddenMin, hiddenMax)),
          Math.round(randomBetween(hiddenMin, hiddenMax)),
        ],
        l2: randomBetween(l2Min, l2Max),
      };
    }

    const best = trials.reduce((prev, current) =>
      current.loss < prev.loss ? current : prev,
    );

    return {
      learningRate: clamp(
        best.params.learningRate * randomBetween(0.7, 1.3),
        lrMin,
        lrMax,
      ),
      dropoutRate: clamp(
        best.params.dropoutRate + randomBetween(-0.05, 0.05),
        dropMin,
        dropMax,
      ),
      hiddenUnits: [
        clamp(
          Math.round(
            best.params.hiddenUnits[0] + randomBetween(-16, 16),
          ),
          hiddenMin,
          hiddenMax,
        ),
        clamp(
          Math.round(
            best.params.hiddenUnits[1] + randomBetween(-16, 16),
          ),
          hiddenMin,
          hiddenMax,
        ),
      ] as [number, number],
      l2: clamp(best.params.l2 * randomBetween(0.5, 1.5), l2Min, l2Max),
    };
  }

  private async evaluateHyperParams(
    dataset: SequenceDataset,
    windows: WalkForwardWindow[],
    config: TrainingConfig,
    params: HyperParams,
  ): Promise<{ loss: number; windowMetrics: WalkForwardSummary[] }> {
    const summaries: WalkForwardSummary[] = [];
    let aggregatedLoss = 0;

    for (const window of windows) {
      const trainSlice = this.sliceDataset(dataset, window.trainStart, window.trainEnd);
      const valSlice = this.sliceDataset(dataset, window.valStart, window.valEnd);

      const { model, history, bestValLoss } = await this.fitModel(
        trainSlice,
        valSlice,
        params,
        config,
      );

      aggregatedLoss += bestValLoss;
      summaries.push({
        window: window.label,
        validationLoss: bestValLoss,
        epochsRun: history.epoch.length,
        samples: valSlice.targets.length,
      });

      model.dispose();
    }

    return {
      loss: aggregatedLoss / windows.length,
      windowMetrics: summaries,
    };
  }

  private sliceDataset(
    dataset: SequenceDataset,
    start: number,
    end: number,
  ): SequenceDataset {
    const safeStart = Math.max(0, start);
    const safeEnd = Math.min(dataset.features.length, end);
    return {
      features: dataset.features.slice(safeStart, safeEnd),
      targets: dataset.targets.slice(safeStart, safeEnd),
      dates: dataset.dates.slice(safeStart, safeEnd),
    };
  }

  private async trainFinalModel(
    dataset: SequenceDataset,
    config: TrainingConfig,
    params: HyperParams,
  ): Promise<{ model: tf.LayersModel; history: tf.History; bestValLoss: number }> {
    const valSize =
      config.validationSize ?? Math.max(20, Math.round(dataset.features.length * 0.1));
    const trainEnd = Math.max(dataset.features.length - valSize, 1);

    const trainSlice = this.sliceDataset(dataset, 0, trainEnd);
    const valSlice = this.sliceDataset(dataset, trainEnd, dataset.features.length);
    return this.fitModel(trainSlice, valSlice, params, config);
  }

  private async fitModel(
    train: SequenceDataset,
    val: SequenceDataset,
    params: HyperParams,
    config: TrainingConfig,
  ): Promise<{ model: tf.LayersModel; history: tf.History; bestValLoss: number }> {
    const featureCount = train.features[0]?.[0]?.length;
    if (!featureCount) {
      throw new Error("LSTMPredictor: invalid training dataset");
    }

    const model = this.buildModel(featureCount, params);
    const trainX = tf.tensor(train.features);
    const trainY = tf.tensor(train.targets);
    const valX = tf.tensor(val.features);
    const valY = tf.tensor(val.targets);

    const patience = config.patience ?? 8;
    const callback = this.createEarlyStoppingCallback(model, patience);

    const history = await model.fit(trainX, trainY, {
      epochs: config.epochs ?? 50,
      batchSize: config.batchSize ?? 32,
      validationData: [valX, valY],
      shuffle: true,
      callbacks: [callback],
    });

    trainX.dispose();
    trainY.dispose();
    valX.dispose();
    valY.dispose();

    const valLosses = history.history.val_loss as number[] | undefined;
    const bestValLoss =
      valLosses && valLosses.length > 0
        ? Math.min(...valLosses.filter(Number.isFinite))
        : Number.POSITIVE_INFINITY;

    return { model, history, bestValLoss };
  }

  private buildModel(featureCount: number, params: HyperParams): tf.LayersModel {
    const model = tf.sequential();
    model.add(
      tf.layers.inputLayer({
        inputShape: [this.sequenceLength, featureCount],
      }),
    );
    model.add(
      tf.layers.lstm({
        units: params.hiddenUnits[0],
        returnSequences: true,
        kernelRegularizer: tf.regularizers.l2({ l2: params.l2 }),
      }),
    );
    model.add(tf.layers.dropout({ rate: params.dropoutRate }));
    model.add(
      tf.layers.lstm({
        units: params.hiddenUnits[1],
        returnSequences: false,
        kernelRegularizer: tf.regularizers.l2({ l2: params.l2 }),
      }),
    );
    model.add(tf.layers.dropout({ rate: params.dropoutRate }));
    model.add(tf.layers.dense({ units: this.horizons.length, activation: "linear" }));

    const optimizer = tf.train.adam(params.learningRate);
    model.compile({
      optimizer,
      loss: "meanSquaredError",
    });
    return model;
  }

  private createEarlyStoppingCallback(
    model: tf.LayersModel,
    patience: number,
  ): tf.CustomCallbackConfig {
    let best = Number.POSITIVE_INFINITY;
    let wait = 0;
    return {
      onEpochEnd: async (_epoch, logs) => {
        const valLoss = logs?.val_loss;
        if (typeof valLoss !== "number") {
          return;
        }
        if (valLoss + 1e-5 < best) {
          best = valLoss;
          wait = 0;
        } else {
          wait += 1;
          if (wait >= patience) {
            model.stopTraining = true;
          }
        }
      },
    };
  }

  private async estimateFeatureImportance(
    dataset: SequenceDataset,
  ): Promise<FeatureImportance[]> {
    if (!this.model) {
      return [];
    }

    const sampleSize = Math.min(200, dataset.features.length);
    if (sampleSize === 0) {
      return [];
    }

    const indices = Array.from({ length: sampleSize }, (_, idx) => idx);
    const baseFeatures = indices.map((idx) =>
      cloneSequence(dataset.features[idx]),
    );
    const baseTargets = indices.map((idx) => dataset.targets[idx]);

    const baselineLoss = await this.computeLoss(baseFeatures, baseTargets);
    const scores: number[] = new Array(this.featureNames.length).fill(0);

    for (let featureIdx = 0; featureIdx < this.featureNames.length; featureIdx += 1) {
      const mutated = baseFeatures.map((sequence) =>
        sequence.map((step) => [...step]),
      );
      const columnValues = mutated.flatMap((sequence) =>
        sequence.map((step) => step[featureIdx]),
      );
      shuffleInPlace(columnValues);
      let pointer = 0;
      mutated.forEach((sequence) => {
        sequence.forEach((step) => {
          step[featureIdx] = columnValues[pointer];
          pointer = (pointer + 1) % columnValues.length;
        });
      });

      const mutatedLoss = await this.computeLoss(mutated, baseTargets);
      scores[featureIdx] = mutatedLoss - baselineLoss;
    }

    const maxScore =
      scores.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0) || 1;

    return scores
      .map((score, idx) => ({
        feature: this.featureNames[idx] ?? `f${idx}`,
        score,
        normalized: Math.abs(score) / maxScore,
      }))
      .sort((a, b) => b.normalized - a.normalized);
  }

  private async computeLoss(
    features: number[][][],
    targets: number[][],
  ): Promise<number> {
    if (!this.model) {
      return 0;
    }

    const tensors = tf.tidy(() => {
      const input = tf.tensor(features);
      const predictions = this.model!.predict(input) as tf.Tensor;
      return { input, predictions };
    });

    const predicted = (await tensors.predictions.array()) as number[][];
    tensors.input.dispose();
    tensors.predictions.dispose();

    let loss = 0;
    let count = 0;
    for (let i = 0; i < predicted.length; i += 1) {
      for (let j = 0; j < predicted[i].length; j += 1) {
        const diff = predicted[i][j] - targets[i][j];
        loss += diff ** 2;
        count += 1;
      }
    }

    return loss / Math.max(count, 1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function shuffleInPlace(values: number[]): void {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
}

function cloneSequence(sequence: number[][]): number[][] {
  return sequence.map((row) => [...row]);
}
