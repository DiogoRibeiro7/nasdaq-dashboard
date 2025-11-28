/**
 * Unit tests for the stats module.
 */

import { describe, it, expect } from "vitest";
import {
  computeStats,
  computeCorrelationMatrix,
  computeRollingVolatility,
  computeRollingReturn,
  computeDrawdown,
  getDailyLogReturns,
  computeReturnDistribution,
  computeHigherMoments,
  computeSharpeRatio,
  type CorrelationMatrix,
} from "@/lib/stats";
import type { StockTimeSeriesPoint } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock stock time series point with minimal required data.
 */
function createPoint(date: string, close: number): StockTimeSeriesPoint {
  return {
    date,
    open: close,
    high: close,
    low: close,
    close,
    adjustedClose: close,
    volume: 1000000,
  };
}

/**
 * Creates a series of points with incrementing dates and specified closes.
 */
function createSeries(closes: number[]): StockTimeSeriesPoint[] {
  return closes.map((close, i) => {
    const date = new Date(2024, 0, i + 1).toISOString().split("T")[0];
    return createPoint(date, close);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// computeStats Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeStats", () => {
  describe("normal series", () => {
    it("should compute lastClose from the most recent price", () => {
      const series = createSeries([100, 105, 110, 115, 120]);
      const stats = computeStats(series);

      expect(stats.lastClose).toBe(120);
    });

    it("should compute positive returns correctly", () => {
      // Create a series long enough for 1M return (21+ days)
      const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
      const series = createSeries(closes);
      const stats = computeStats(series);

      // Last close is 124, price 21 days ago was 103
      // Return = (124 - 103) / 103 ≈ 0.2039
      expect(stats.oneMonthReturn).toBeCloseTo(0.2039, 2);
    });

    it("should compute negative returns correctly", () => {
      // Decreasing prices
      const closes = Array.from({ length: 25 }, (_, i) => 124 - i);
      const series = createSeries(closes);
      const stats = computeStats(series);

      expect(stats.oneMonthReturn).toBeLessThan(0);
    });

    it("should compute annualized volatility for varying prices", () => {
      // Series with some variation
      const closes = [100, 102, 99, 103, 98, 104, 101, 105, 100, 106];
      const series = createSeries(closes);
      const stats = computeStats(series);

      expect(stats.annualizedVolatility).not.toBeNull();
      expect(stats.annualizedVolatility).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty series", () => {
      const stats = computeStats([]);

      expect(stats.lastClose).toBeNaN();
      expect(stats.oneMonthReturn).toBeNull();
      expect(stats.threeMonthReturn).toBeNull();
      expect(stats.annualizedVolatility).toBeNull();
    });

    it("should handle single-point series", () => {
      const series = createSeries([150]);
      const stats = computeStats(series);

      expect(stats.lastClose).toBe(150);
      expect(stats.oneMonthReturn).toBeNull();
      expect(stats.threeMonthReturn).toBeNull();
      expect(stats.annualizedVolatility).toBeNull();
    });

    it("should return zero volatility for constant prices", () => {
      // All prices are the same - no variation
      const closes = Array.from({ length: 10 }, () => 100);
      const series = createSeries(closes);
      const stats = computeStats(series);

      // Log returns of constant prices are all 0, so std dev is 0
      expect(stats.annualizedVolatility).toBe(0);
    });

    it("should handle series with NaN values by filtering them out", () => {
      const series = createSeries([100, 105, 110]);
      series[1].close = NaN;

      const stats = computeStats(series);

      // Should still compute based on valid values
      expect(stats.lastClose).toBe(110);
    });

    it("should handle series with zero or negative prices", () => {
      const series = createSeries([100, 0, -50, 110]);
      const stats = computeStats(series);

      // Invalid prices should be filtered out
      expect(stats.lastClose).toBe(110);
    });
  });

  describe("insufficient data", () => {
    it("should return null for 1M return when series is too short", () => {
      // Only 10 days, need 22+ for 1M return
      const closes = Array.from({ length: 10 }, (_, i) => 100 + i);
      const series = createSeries(closes);
      const stats = computeStats(series);

      expect(stats.oneMonthReturn).toBeNull();
      expect(stats.lastClose).toBe(109);
    });

    it("should return null for 3M return when series is too short", () => {
      // Only 30 days, need 64+ for 3M return
      const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
      const series = createSeries(closes);
      const stats = computeStats(series);

      expect(stats.threeMonthReturn).toBeNull();
      expect(stats.oneMonthReturn).not.toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeCorrelationMatrix Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeCorrelationMatrix", () => {
  describe("normal cases", () => {
    it("should return perfect correlation for identical series", () => {
      const closes = [100, 102, 101, 105, 103, 108];
      const seriesA = closes.map((c, i) => ({
        date: `2024-01-0${i + 1}`,
        close: c,
      }));
      const seriesB = closes.map((c, i) => ({
        date: `2024-01-0${i + 1}`,
        close: c,
      }));

      const matrix = computeCorrelationMatrix({
        AAPL: seriesA,
        MSFT: seriesB,
      });

      expect(matrix.symbols).toEqual(["AAPL", "MSFT"]);
      expect(matrix.values[0][0]).toBe(1); // AAPL with itself
      expect(matrix.values[1][1]).toBe(1); // MSFT with itself
      expect(matrix.values[0][1]).toBeCloseTo(1, 5); // Perfect correlation
      expect(matrix.values[1][0]).toBeCloseTo(1, 5); // Symmetric
    });

    it("should return negative correlation for inverse log-return series", () => {
      // For negative correlation, we need opposite log returns
      // If A goes up by x%, B should go down by ~x%
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06"];
      // A: 100 -> 110 -> 100 -> 110 -> 100 -> 110 (alternating +10%, -9.1%)
      const seriesA = [
        { date: dates[0], close: 100 },
        { date: dates[1], close: 110 },
        { date: dates[2], close: 100 },
        { date: dates[3], close: 110 },
        { date: dates[4], close: 100 },
        { date: dates[5], close: 110 },
      ];
      // B: inverse pattern
      const seriesB = [
        { date: dates[0], close: 110 },
        { date: dates[1], close: 100 },
        { date: dates[2], close: 110 },
        { date: dates[3], close: 100 },
        { date: dates[4], close: 110 },
        { date: dates[5], close: 100 },
      ];

      const matrix = computeCorrelationMatrix({
        AAPL: seriesA,
        MSFT: seriesB,
      });

      // Should be strongly negative (close to -1)
      expect(matrix.values[0][1]).toBeLessThan(-0.9);
    });

    it("should handle three or more symbols", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"];
      const seriesA = dates.map((date, i) => ({ date, close: 100 + i }));
      const seriesB = dates.map((date, i) => ({ date, close: 200 + i * 2 }));
      const seriesC = dates.map((date, i) => ({ date, close: 150 + i * 1.5 }));

      const matrix = computeCorrelationMatrix({
        AAPL: seriesA,
        GOOGL: seriesB,
        MSFT: seriesC,
      });

      expect(matrix.symbols).toHaveLength(3);
      expect(matrix.values).toHaveLength(3);
      expect(matrix.values[0]).toHaveLength(3);

      // All should be positively correlated since all are increasing
      expect(matrix.values[0][1]).toBeGreaterThan(0);
      expect(matrix.values[0][2]).toBeGreaterThan(0);
      expect(matrix.values[1][2]).toBeGreaterThan(0);
    });

    it("should only use dates common to all series", () => {
      // Need enough common dates for log returns (at least 4 dates = 3 returns)
      const seriesA = [
        { date: "2024-01-01", close: 100 },
        { date: "2024-01-02", close: 105 },
        { date: "2024-01-03", close: 110 },
        { date: "2024-01-04", close: 115 },
        { date: "2024-01-05", close: 120 },
      ];
      const seriesB = [
        { date: "2024-01-01", close: 200 },
        { date: "2024-01-02", close: 210 },
        { date: "2024-01-03", close: 220 },
        { date: "2024-01-04", close: 230 },
        { date: "2024-01-06", close: 240 }, // Different last date
      ];

      const matrix = computeCorrelationMatrix({
        AAPL: seriesA,
        MSFT: seriesB,
      });

      // Common dates: 01-01 to 01-04 (4 dates = 3 log returns)
      // Should compute correlation based on those common dates
      expect(matrix.values[0][1]).not.toBeNaN();
    });
  });

  describe("edge cases", () => {
    it("should return empty matrix for no symbols", () => {
      const matrix = computeCorrelationMatrix({});

      expect(matrix.symbols).toEqual([]);
      expect(matrix.values).toEqual([]);
    });

    it("should return 1x1 matrix with value 1 for single symbol", () => {
      const series = [
        { date: "2024-01-01", close: 100 },
        { date: "2024-01-02", close: 105 },
      ];

      const matrix = computeCorrelationMatrix({ AAPL: series });

      expect(matrix.symbols).toEqual(["AAPL"]);
      expect(matrix.values).toEqual([[1]]);
    });

    it("should return NaN for constant series (zero variance)", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"];
      const seriesA = dates.map((date) => ({ date, close: 100 })); // Constant
      const seriesB = dates.map((date, i) => ({ date, close: 100 + i })); // Varying

      const matrix = computeCorrelationMatrix({
        AAPL: seriesA,
        MSFT: seriesB,
      });

      // Correlation with constant series is undefined (NaN)
      expect(matrix.values[0][1]).toBeNaN();
    });

    it("should return NaN when insufficient common dates", () => {
      const seriesA = [
        { date: "2024-01-01", close: 100 },
        { date: "2024-01-02", close: 105 },
      ];
      const seriesB = [
        { date: "2024-01-03", close: 200 }, // No overlap
        { date: "2024-01-04", close: 210 },
      ];

      const matrix = computeCorrelationMatrix({
        AAPL: seriesA,
        MSFT: seriesB,
      });

      // No common dates means no returns to correlate
      expect(matrix.values[0][1]).toBeNaN();
    });
  });

  describe("matrix properties", () => {
    it("should produce symmetric matrix", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"];
      const seriesA = dates.map((date, i) => ({ date, close: 100 + i * 2 }));
      const seriesB = dates.map((date, i) => ({ date, close: 200 + i * 3 }));
      const seriesC = dates.map((date, i) => ({ date, close: 150 - i }));

      const matrix = computeCorrelationMatrix({
        AAPL: seriesA,
        GOOGL: seriesB,
        MSFT: seriesC,
      });

      // Check symmetry: matrix[i][j] === matrix[j][i]
      for (let i = 0; i < matrix.symbols.length; i++) {
        for (let j = 0; j < matrix.symbols.length; j++) {
          expect(matrix.values[i][j]).toBeCloseTo(matrix.values[j][i], 10);
        }
      }
    });

    it("should have 1s on diagonal", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"];
      const seriesA = dates.map((date, i) => ({ date, close: 100 + i }));
      const seriesB = dates.map((date, i) => ({ date, close: 200 - i }));

      const matrix = computeCorrelationMatrix({
        AAPL: seriesA,
        MSFT: seriesB,
      });

      expect(matrix.values[0][0]).toBe(1);
      expect(matrix.values[1][1]).toBe(1);
    });

    it("should sort symbols alphabetically", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"];
      const series = dates.map((date, i) => ({ date, close: 100 + i }));

      const matrix = computeCorrelationMatrix({
        MSFT: series,
        AAPL: series,
        GOOGL: series,
      });

      expect(matrix.symbols).toEqual(["AAPL", "GOOGL", "MSFT"]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeRollingVolatility Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeRollingVolatility", () => {
  it("should return empty array for series shorter than window", () => {
    const series = createSeries([100, 105, 110]);
    const result = computeRollingVolatility(series, 5);

    expect(result).toEqual([]);
  });

  it("should return empty array for window less than 2", () => {
    const series = createSeries([100, 105, 110, 115, 120]);
    const result = computeRollingVolatility(series, 1);

    expect(result).toEqual([]);
  });

  it("should compute rolling volatility for valid series", () => {
    // Create series with 10 points - window of 5 should give us results
    const closes = [100, 102, 98, 104, 101, 103, 99, 105, 100, 106];
    const series = createSeries(closes);
    const result = computeRollingVolatility(series, 5);

    // Should have results starting from day 5 (index 4)
    expect(result.length).toBeGreaterThan(0);
    // All volatilities should be positive for varying prices
    result.forEach((point) => {
      expect(point.vol).toBeGreaterThan(0);
      expect(point.date).toBeDefined();
    });
  });

  it("should return zero volatility for constant prices in window", () => {
    const closes = Array.from({ length: 10 }, () => 100);
    const series = createSeries(closes);
    const result = computeRollingVolatility(series, 5);

    // All volatilities should be 0 for constant prices
    result.forEach((point) => {
      expect(point.vol).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeRollingReturn Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeRollingReturn", () => {
  it("should return empty array for series shorter than window", () => {
    const series = createSeries([100, 105, 110]);
    const result = computeRollingReturn(series, 5);

    expect(result).toEqual([]);
  });

  it("should compute positive rolling returns for increasing prices", () => {
    const closes = [100, 105, 110, 115, 120, 125, 130];
    const series = createSeries(closes);
    const result = computeRollingReturn(series, 3);

    expect(result.length).toBeGreaterThan(0);
    // All returns should be positive for consistently increasing prices
    result.forEach((point) => {
      expect(point.ret).toBeGreaterThan(0);
    });
  });

  it("should compute negative rolling returns for decreasing prices", () => {
    const closes = [130, 125, 120, 115, 110, 105, 100];
    const series = createSeries(closes);
    const result = computeRollingReturn(series, 3);

    expect(result.length).toBeGreaterThan(0);
    // All returns should be negative for consistently decreasing prices
    result.forEach((point) => {
      expect(point.ret).toBeLessThan(0);
    });
  });

  it("should compute correct return value", () => {
    // 100 -> 120 over 3 days = 20% return
    const closes = [100, 105, 110, 120];
    const series = createSeries(closes);
    const result = computeRollingReturn(series, 3);

    expect(result.length).toBe(1);
    expect(result[0].ret).toBeCloseTo(0.2, 5); // 20% return
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeDrawdown Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeDrawdown", () => {
  it("should return empty array for empty series", () => {
    const result = computeDrawdown([]);

    expect(result).toEqual([]);
  });

  it("should return zero drawdown for single point", () => {
    const series = createSeries([100]);
    const result = computeDrawdown(series);

    expect(result.length).toBe(1);
    expect(result[0].drawdown).toBe(0);
    expect(result[0].peakToTrough).toBe(0);
  });

  it("should return zero drawdown for continuously increasing prices", () => {
    const closes = [100, 110, 120, 130, 140];
    const series = createSeries(closes);
    const result = computeDrawdown(series);

    expect(result.length).toBe(5);
    // All drawdowns should be 0 (always at new high)
    result.forEach((point) => {
      expect(point.drawdown).toBe(0);
      expect(point.peakToTrough).toBe(0);
    });
  });

  it("should compute correct drawdown for declining prices", () => {
    // Peak at 100, drops to 90 (10% drawdown), then to 80 (20% drawdown)
    const closes = [100, 90, 80];
    const series = createSeries(closes);
    const result = computeDrawdown(series);

    expect(result.length).toBe(3);
    expect(result[0].drawdown).toBe(0); // At peak
    expect(result[1].drawdown).toBeCloseTo(-0.1, 5); // 10% below peak
    expect(result[2].drawdown).toBeCloseTo(-0.2, 5); // 20% below peak
    expect(result[2].peakToTrough).toBeCloseTo(-0.2, 5); // Max drawdown so far
  });

  it("should track worst drawdown in peakToTrough", () => {
    // Peak at 100, drops to 80 (20%), recovers to 90, drops to 85
    const closes = [100, 80, 90, 85];
    const series = createSeries(closes);
    const result = computeDrawdown(series);

    expect(result[1].drawdown).toBeCloseTo(-0.2, 5); // Current: 20% below
    expect(result[1].peakToTrough).toBeCloseTo(-0.2, 5); // Worst: 20%
    expect(result[2].drawdown).toBeCloseTo(-0.1, 5); // Current: 10% below (peak still 100)
    expect(result[2].peakToTrough).toBeCloseTo(-0.2, 5); // Worst: still 20%
    expect(result[3].drawdown).toBeCloseTo(-0.15, 5); // Current: 15% below
    expect(result[3].peakToTrough).toBeCloseTo(-0.2, 5); // Worst: still 20%
  });

  it("should reset drawdown on new high", () => {
    // Peak at 100, drops to 90, new high at 110
    const closes = [100, 90, 110];
    const series = createSeries(closes);
    const result = computeDrawdown(series);

    expect(result[0].drawdown).toBe(0);
    expect(result[1].drawdown).toBeCloseTo(-0.1, 5);
    expect(result[2].drawdown).toBe(0); // New high = 0 drawdown
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getDailyLogReturns Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("getDailyLogReturns", () => {
  it("should return empty array for empty series", () => {
    const result = getDailyLogReturns([]);
    expect(result).toEqual([]);
  });

  it("should return empty array for single-point series", () => {
    const series = createSeries([100]);
    const result = getDailyLogReturns(series);
    expect(result).toEqual([]);
  });

  it("should compute log returns correctly", () => {
    // 100 -> 110 = ln(1.1) ≈ 0.0953
    const closes = [100, 110];
    const series = createSeries(closes);
    const result = getDailyLogReturns(series);

    expect(result.length).toBe(1);
    expect(result[0].r).toBeCloseTo(Math.log(1.1), 5);
  });

  it("should compute negative log returns correctly", () => {
    // 100 -> 90 = ln(0.9) ≈ -0.1054
    const closes = [100, 90];
    const series = createSeries(closes);
    const result = getDailyLogReturns(series);

    expect(result.length).toBe(1);
    expect(result[0].r).toBeCloseTo(Math.log(0.9), 5);
  });

  it("should include dates in results", () => {
    const closes = [100, 105, 110];
    const series = createSeries(closes);
    const result = getDailyLogReturns(series);

    expect(result.length).toBe(2);
    expect(result[0].date).toBeDefined();
    expect(result[1].date).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeReturnDistribution Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeReturnDistribution", () => {
  it("should return empty array for empty returns", () => {
    const result = computeReturnDistribution([], 10);
    expect(result).toEqual([]);
  });

  it("should return single bin for all equal returns", () => {
    const returns = [
      { date: "2024-01-01", r: 0.01 },
      { date: "2024-01-02", r: 0.01 },
      { date: "2024-01-03", r: 0.01 },
    ];
    const result = computeReturnDistribution(returns, 10);

    expect(result.length).toBe(1);
    expect(result[0].count).toBe(3);
    expect(result[0].binCenter).toBe(0.01);
  });

  it("should create correct number of bins", () => {
    const returns = [
      { date: "2024-01-01", r: -0.05 },
      { date: "2024-01-02", r: 0 },
      { date: "2024-01-03", r: 0.05 },
    ];
    const result = computeReturnDistribution(returns, 10);

    expect(result.length).toBe(10);
  });

  it("should have total count equal to number of returns", () => {
    const returns = [
      { date: "2024-01-01", r: -0.03 },
      { date: "2024-01-02", r: -0.01 },
      { date: "2024-01-03", r: 0.01 },
      { date: "2024-01-04", r: 0.02 },
      { date: "2024-01-05", r: 0.05 },
    ];
    const result = computeReturnDistribution(returns, 5);

    const totalCount = result.reduce((sum, bin) => sum + bin.count, 0);
    expect(totalCount).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeHigherMoments Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeHigherMoments", () => {
  it("should return NaN for less than 3 data points", () => {
    const returns = [
      { date: "2024-01-01", r: 0.01 },
      { date: "2024-01-02", r: 0.02 },
    ];
    const result = computeHigherMoments(returns);

    expect(result.mean).toBeNaN();
    expect(result.std).toBeNaN();
    expect(result.skewness).toBeNaN();
    expect(result.kurtosis).toBeNaN();
  });

  it("should compute correct mean", () => {
    const returns = [
      { date: "2024-01-01", r: 0.01 },
      { date: "2024-01-02", r: 0.02 },
      { date: "2024-01-03", r: 0.03 },
    ];
    const result = computeHigherMoments(returns);

    expect(result.mean).toBeCloseTo(0.02, 5);
  });

  it("should have zero skewness for symmetric distribution", () => {
    // Symmetric around 0
    const returns = [
      { date: "2024-01-01", r: -0.02 },
      { date: "2024-01-02", r: -0.01 },
      { date: "2024-01-03", r: 0 },
      { date: "2024-01-04", r: 0.01 },
      { date: "2024-01-05", r: 0.02 },
    ];
    const result = computeHigherMoments(returns);

    expect(result.skewness).toBeCloseTo(0, 2);
  });

  it("should return NaN skewness for zero variance", () => {
    const returns = [
      { date: "2024-01-01", r: 0.01 },
      { date: "2024-01-02", r: 0.01 },
      { date: "2024-01-03", r: 0.01 },
    ];
    const result = computeHigherMoments(returns);

    expect(result.mean).toBeCloseTo(0.01, 5);
    expect(result.std).toBe(0);
    expect(result.skewness).toBeNaN();
    expect(result.kurtosis).toBeNaN();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeSharpeRatio Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeSharpeRatio", () => {
  it("should return null for less than 2 data points", () => {
    const returns = [{ date: "2024-01-01", r: 0.01 }];
    const result = computeSharpeRatio(returns);

    expect(result).toBeNull();
  });

  it("should return null for zero volatility", () => {
    const returns = [
      { date: "2024-01-01", r: 0.01 },
      { date: "2024-01-02", r: 0.01 },
      { date: "2024-01-03", r: 0.01 },
    ];
    const result = computeSharpeRatio(returns);

    expect(result).toBeNull();
  });

  it("should compute positive Sharpe for positive returns", () => {
    // Positive mean return with some volatility
    const returns = [
      { date: "2024-01-01", r: 0.005 },
      { date: "2024-01-02", r: 0.010 },
      { date: "2024-01-03", r: 0.003 },
      { date: "2024-01-04", r: 0.008 },
      { date: "2024-01-05", r: 0.006 },
    ];
    const result = computeSharpeRatio(returns);

    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });

  it("should compute negative Sharpe for negative returns", () => {
    // Negative mean return
    const returns = [
      { date: "2024-01-01", r: -0.005 },
      { date: "2024-01-02", r: -0.010 },
      { date: "2024-01-03", r: -0.003 },
      { date: "2024-01-04", r: -0.008 },
      { date: "2024-01-05", r: -0.006 },
    ];
    const result = computeSharpeRatio(returns);

    expect(result).not.toBeNull();
    expect(result).toBeLessThan(0);
  });

  it("should account for risk-free rate", () => {
    const returns = [
      { date: "2024-01-01", r: 0.001 },
      { date: "2024-01-02", r: 0.002 },
      { date: "2024-01-03", r: 0.001 },
      { date: "2024-01-04", r: 0.002 },
    ];

    const sharpeZeroRf = computeSharpeRatio(returns, 0);
    const sharpeHighRf = computeSharpeRatio(returns, 0.10); // 10% risk-free rate

    expect(sharpeZeroRf).not.toBeNull();
    expect(sharpeHighRf).not.toBeNull();
    expect(sharpeHighRf!).toBeLessThan(sharpeZeroRf!);
  });
});
