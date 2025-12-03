/**
 * StandardScaler implements z-score normalization for tabular data.
 *
 * The scaler keeps per-feature mean and standard deviation vectors so that
 * matrices can be normalized and denormalized deterministically. The class
 * mirrors scikit-learn's API which makes it familiar for quants and ML
 * engineers.
 */
export class StandardScaler {
  private mean: number[] = [];
  private std: number[] = [];
  private fitted = false;

  constructor(private readonly epsilon = 1e-8) {}

  /**
   * Returns the number of features the scaler was fitted on.
   */
  get featureCount(): number {
    return this.mean.length;
  }

  /**
   * Fits the scaler by computing per-feature mean and standard deviation.
   *
   * @param data - Matrix of size (samples, features)
   */
  fit(data: number[][]): void {
    if (data.length === 0) {
      throw new Error("StandardScaler.fit: received empty dataset");
    }

    const featureCount = data[0].length;
    this.mean = new Array(featureCount).fill(0);
    this.std = new Array(featureCount).fill(0);

    for (const row of data) {
      if (row.length !== featureCount) {
        throw new Error("StandardScaler.fit: inconsistent feature dimensions");
      }
      row.forEach((value, idx) => {
        this.mean[idx] += value;
      });
    }

    this.mean = this.mean.map((sum) => sum / data.length);

    for (const row of data) {
      row.forEach((value, idx) => {
        const diff = value - this.mean[idx];
        this.std[idx] += diff * diff;
      });
    }

    this.std = this.std.map((sum) => {
      const variance = sum / data.length;
      const std = Math.sqrt(variance);
      return Number.isFinite(std) && std > this.epsilon ? std : 1;
    });

    this.fitted = true;
  }

  /**
   * Fits the scaler and transforms the dataset in one pass.
   *
   * @param data - Matrix to normalize
   * @returns Normalized matrix
   */
  fitTransform(data: number[][]): number[][] {
    this.fit(data);
    return this.transform(data);
  }

  /**
   * Applies normalization to a matrix.
   */
  transform(data: number[][]): number[][] {
    this.ensureFitted();
    return data.map((row) => this.transformSingle(row));
  }

  /**
   * Applies normalization to a single feature vector.
   */
  transformSingle(row: number[]): number[] {
    this.ensureFitted();
    if (row.length !== this.mean.length) {
      throw new Error("StandardScaler.transformSingle: dimension mismatch");
    }

    return row.map((value, idx) => (value - this.mean[idx]) / this.std[idx]);
  }

  /**
   * Reverses normalization for a matrix.
   */
  inverseTransform(data: number[][]): number[][] {
    this.ensureFitted();
    return data.map((row) =>
      row.map((value, idx) => value * this.std[idx] + this.mean[idx]),
    );
  }

  /**
   * Serializes scaler state to persist alongside a model.
   */
  toJSON(): ScalerState {
    this.ensureFitted();
    return {
      mean: [...this.mean],
      std: [...this.std],
    };
  }

  /**
   * Restores scaler state.
   */
  fromJSON(state: ScalerState): void {
    if (state.mean.length === 0 || state.std.length === 0) {
      throw new Error("StandardScaler.fromJSON: invalid serialized state");
    }

    if (state.mean.length !== state.std.length) {
      throw new Error(
        "StandardScaler.fromJSON: mean and std vectors must match length",
      );
    }

    this.mean = [...state.mean];
    this.std = state.std.map((value) =>
      Number.isFinite(value) && value > this.epsilon ? value : 1,
    );
    this.fitted = true;
  }

  private ensureFitted(): void {
    if (!this.fitted) {
      throw new Error("StandardScaler: call fit() before transforming data");
    }
  }
}

/**
 * Serialized representation of the scaler.
 */
export type ScalerState = {
  mean: number[];
  std: number[];
};
