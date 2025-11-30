export type PcaResult = {
  symbols: string[];
  eigenvalues: number[];
  explainedVariance: number[];
  cumulativeExplained: number[];
  /**
   * Loadings array with shape [component][symbol].
   * loadings[i][j] is the exposure of symbol j to principal component i.
   */
  loadings: number[][];
};

export function computeReturnPca(
  seriesBySymbol: Record<string, { date: string; close: number }[]>,
): PcaResult | null {
  const symbols = Object.keys(seriesBySymbol);
  if (symbols.length === 0) {
    return null;
  }

  const dateSets = symbols
    .map((symbol) => new Set(seriesBySymbol[symbol].map((point) => point.date)))
    .filter((set) => set.size > 0);
  if (dateSets.length === 0) {
    return null;
  }

  let commonDates = [...dateSets[0]];
  for (let i = 1; i < dateSets.length; i++) {
    commonDates = commonDates.filter((date) => dateSets[i].has(date));
  }
  commonDates.sort();
  if (commonDates.length < 2) {
    return null;
  }

  const dateToIndex = new Map<string, number>();
  commonDates.forEach((date, index) => dateToIndex.set(date, index));

  const returnsMatrix: number[][] = symbols.map(() => []);

  for (let s = 0; s < symbols.length; s++) {
    const series = seriesBySymbol[symbols[s]];
    const closeMap = new Map(series.map((point) => [point.date, point.close]));

    const returns: number[] = [];
    for (let i = 1; i < commonDates.length; i++) {
      const prevDate = commonDates[i - 1];
      const currDate = commonDates[i];
      const prevClose = closeMap.get(prevDate);
      const currClose = closeMap.get(currDate);
      if (prevClose && currClose && prevClose > 0 && currClose > 0) {
        returns.push(Math.log(currClose / prevClose));
      } else {
        returns.push(0);
      }
    }
    returnsMatrix[s] = returns;
  }

  const standardized = returnsMatrix.map((series) => {
    const mean =
      series.reduce((sum, value) => sum + value, 0) / series.length;
    const variance =
      series.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (series.length - 1);
    const std = variance > 0 ? Math.sqrt(variance) : 1;
    return series.map((value) => (value - mean) / std);
  });

  const n = symbols.length;
  const covariance = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const seriesI = standardized[i];
      const seriesJ = standardized[j];
      let sum = 0;
      for (let t = 0; t < seriesI.length; t++) {
        sum += seriesI[t] * seriesJ[t];
      }
      const value = sum / (seriesI.length - 1);
      covariance[i][j] = value;
      covariance[j][i] = value;
    }
  }

  const eig = eigenDecomposition(covariance);
  if (!eig) {
    return null;
  }
  const { eigenvalues, eigenvectors } = eig;
  const totalVar = eigenvalues.reduce((sum, value) => sum + value, 0) || 1;
  const explainedVariance = eigenvalues.map((value) => value / totalVar);
  const cumulativeExplained = explainedVariance.map((value, index) =>
    explainedVariance
      .slice(0, index + 1)
      .reduce((sum, current) => sum + current, 0),
  );

  return {
    symbols,
    eigenvalues,
    explainedVariance,
    cumulativeExplained,
    loadings: eigenvectors,
  };
}

function eigenDecomposition(
  matrix: number[][],
): { eigenvalues: number[]; eigenvectors: number[][] } | null {
  const n = matrix.length;
  if (n === 0) {
    return null;
  }

  const working = matrix.map((row) => [...row]);
  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];

  for (let component = 0; component < n; component++) {
    let vector = Array.from({ length: n }, () => Math.random());
    vector = normalize(vector);

    let eigenvalue = 0;
    for (let iteration = 0; iteration < 1000; iteration++) {
      const multiplied = multiplyMatrixVector(working, vector);
      const norm = Math.hypot(...multiplied);
      if (!Number.isFinite(norm) || norm === 0) {
        break;
      }
      const nextVector = multiplied.map((value) => value / norm);
      const diff = nextVector.map((value, index) => value - vector[index]);
      const diffNorm = Math.hypot(...diff);
      vector = nextVector;
      eigenvalue = dot(innerMultiply(matrix, vector), vector);
      if (diffNorm < 1e-8) {
        break;
      }
    }

    eigenvalues.push(eigenvalue);
    eigenvectors.push(vector);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        working[i][j] -= eigenvalue * vector[i] * vector[j];
      }
    }
  }

  const zipped = eigenvalues.map((value, index) => ({
    value,
    vector: eigenvectors[index],
  }));
  zipped.sort((a, b) => b.value - a.value);

  return {
    eigenvalues: zipped.map((item) => item.value),
    eigenvectors: zipped.map((item) => item.vector),
  };
}

function multiplyMatrixVector(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0),
  );
}

function normalize(vector: number[]): number[] {
  const norm = Math.hypot(...vector);
  if (norm === 0) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / norm);
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function innerMultiply(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0),
  );
}
