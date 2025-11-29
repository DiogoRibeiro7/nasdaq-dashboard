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
  computeCapmStats,
  detectGaps,
  detectVolumeSpikes,
  computeMovingAverage,
  computeDualMovingAverages,
  detectMovingAverageCrossovers,
  backtestMaCrossoverStrategy,
  backtestBuyAndHold,
  computeRsi,
  computeMacd,
  classifyRegimes,
  computePortfolioSeries,
  computePortfolioMetrics,
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

/**
 * Creates a fully specified point for event-detection tests.
 */
function createCustomPoint(
  date: string,
  open: number,
  close: number,
  volume: number,
): StockTimeSeriesPoint {
  const high = Math.max(open, close);
  const low = Math.min(open, close);

  return {
    date,
    open,
    high,
    low,
    close,
    adjustedClose: close,
    volume,
  };
}

/**
 * Creates a close-only series from specified log returns.
 */
function createCloseSeriesFromLogReturns(
  logReturns: number[],
  startPrice = 100,
): Array<{ date: string; close: number }> {
  const series: Array<{ date: string; close: number }> = [];
  let price = startPrice;

  const startDate = new Date(2024, 0, 1);
  series.push({
    date: startDate.toISOString().split("T")[0],
    close: price,
  });

  for (let i = 0; i < logReturns.length; i++) {
    price *= Math.exp(logReturns[i]);
    const dateObj = new Date(2024, 0, i + 2);
    series.push({ date: dateObj.toISOString().split("T")[0], close: price });
  }

  return series;
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
// Event Detection Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("detectGaps", () => {
  it("should flag days with gaps meeting the threshold", () => {
    const series = [
      createCustomPoint("2024-01-01", 100, 100, 100000),
      createCustomPoint("2024-01-02", 110, 112, 120000),
      createCustomPoint("2024-01-03", 108, 109, 130000),
    ];

    const result = detectGaps(series, 0.05);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2024-01-02");
    expect(result[0].gapPct).toBeCloseTo(0.1, 5);
  });

  it("should ignore gaps below the threshold", () => {
    const series = [
      createCustomPoint("2024-01-01", 100, 100, 100000),
      createCustomPoint("2024-01-02", 101.5, 102, 110000), // ~1.5% gap
    ];

    const result = detectGaps(series, 0.03);

    expect(result).toHaveLength(0);
  });
});

describe("detectVolumeSpikes", () => {
  it("should flag high z-score volume days", () => {
    const series = [
      createCustomPoint("2024-01-01", 100, 100, 100),
      createCustomPoint("2024-01-02", 100, 100, 100),
      createCustomPoint("2024-01-03", 100, 100, 100),
      createCustomPoint("2024-01-04", 100, 100, 100),
      createCustomPoint("2024-01-05", 100, 100, 100),
      createCustomPoint("2024-01-06", 100, 100, 2000),
    ];

    const result = detectVolumeSpikes(series, 2);

    expect(result.length).toBe(1);
    expect(result[0].date).toBe("2024-01-06");
    expect(result[0].zScore).toBeGreaterThan(2);
  });

  it("should return empty array when volume has no variance", () => {
    const series = [
      createCustomPoint("2024-01-01", 100, 100, 500),
      createCustomPoint("2024-01-02", 100, 100, 500),
      createCustomPoint("2024-01-03", 100, 100, 500),
    ];

    const result = detectVolumeSpikes(series, 2);

    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Moving Average Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeMovingAverage", () => {
  it("should compute SMA aligned to first complete window", () => {
    const series = createSeries([10, 20, 30, 40, 50]).map(({ date, close }) => ({
      date,
      close,
    }));
    const ma = computeMovingAverage(series, 3);

    expect(ma).toHaveLength(3);
    expect(ma[0]).toEqual({ date: series[2].date, ma: 20 });
    expect(ma[2].ma).toBeCloseTo((30 + 40 + 50) / 3, 5);
  });

  it("should return empty array when window larger than series", () => {
    const series = createSeries([10, 20]).map(({ date, close }) => ({
      date,
      close,
    }));
    const ma = computeMovingAverage(series, 5);

    expect(ma).toEqual([]);
  });
});

describe("computeDualMovingAverages", () => {
  it("should merge series with short and long averages", () => {
    const series = createSeries([10, 20, 30, 40]).map(({ date, close }) => ({
      date,
      close,
    }));

    const result = computeDualMovingAverages(series, 2, 3);

    expect(result).toHaveLength(series.length);
    expect(result[0].maShort).toBeNull();
    expect(result[1].maShort).toBe(15);
    expect(result[2].maLong).toBeCloseTo((10 + 20 + 30) / 3, 5);
  });
});

describe("detectMovingAverageCrossovers", () => {
  it("should detect golden and death crosses", () => {
    const data = [
      { date: "2024-01-01", maShort: null, maLong: null },
      { date: "2024-01-02", maShort: 9, maLong: 10 },
      { date: "2024-01-03", maShort: 11, maLong: 10 },
      { date: "2024-01-04", maShort: 12, maLong: 11 },
      { date: "2024-01-05", maShort: 10, maLong: 11 },
    ];

    const events = detectMovingAverageCrossovers(data);

    expect(events).toEqual([
      { date: "2024-01-03", type: "golden" },
      { date: "2024-01-05", type: "death" },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// backtestMaCrossoverStrategy Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("backtestMaCrossoverStrategy", () => {
  it("should return empty results for empty series", () => {
    const result = backtestMaCrossoverStrategy([], []);
    expect(result.trades).toEqual([]);
    expect(result.equityCurve).toEqual([]);
    expect(result.totalReturn).toBe(0);
  });

  it("should generate trades and equity curve", () => {
    const series = [
      { date: "2024-01-01", close: 100 },
      { date: "2024-01-02", close: 105 },
      { date: "2024-01-03", close: 110 },
      { date: "2024-01-04", close: 90 },
    ];
    const crossovers = [
      { date: "2024-01-02", type: "golden" },
      { date: "2024-01-04", type: "death" },
    ];

    const result = backtestMaCrossoverStrategy(series, crossovers);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]).toMatchObject({
      entryDate: "2024-01-02",
      exitDate: "2024-01-04",
    });
    expect(result.equityCurve).toHaveLength(series.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeRsi Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeRsi", () => {
  it("should return empty array for empty series", () => {
    const result = computeRsi([], 14);
    expect(result).toEqual([]);
  });

  it("should compute RSI with nulls for insufficient history", () => {
    const series = createSeries([100, 102, 101, 103, 105, 104, 103, 106]).map(
      ({ date, close }) => ({ date, close }),
    );
    const result = computeRsi(series, 3);
    expect(result.slice(0, 3).every((point) => point.rsi === null)).toBe(true);
    expect(result[3].rsi).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeMacd Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeMacd", () => {
  it("should return empty array for invalid parameters", () => {
    const series = createSeries([100, 101, 102]).map(({ date, close }) => ({
      date,
      close,
    }));
    const result = computeMacd(series, 0, 0, 0);
    expect(result).toEqual([]);
  });

  it("should compute MACD values", () => {
    const series = createSeries([
      100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
    ]).map(({ date, close }) => ({ date, close }));
    const result = computeMacd(series, 2, 5, 3);
    expect(result.length).toBe(series.length);
    expect(result[result.length - 1].macd).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyRegimes Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyRegimes", () => {
  it("should classify regimes based on MA and RSI", () => {
    const series = createSeries([100, 101, 102, 101, 99]).map(
      ({ date, close }) => ({ date, close }),
    );
    const maShort = series.map((point) => ({ date: point.date, ma: point.close }));
    const maLong = series.map((point) => ({ date: point.date, ma: point.close - 1 }));
    const rsi = series.map((point) => ({ date: point.date, rsi: 60 }));

    const regimes = classifyRegimes({
      closeSeries: series,
      maShortSeries: maShort,
      maLongSeries: maLong,
      rsiSeries: rsi,
    });

    expect(regimes.length).toBeGreaterThan(0);
    expect(regimes[regimes.length - 1].regime).toBe("uptrend");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computePortfolioSeries Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computePortfolioSeries", () => {
  it("should return empty array when no symbols", () => {
    const result = computePortfolioSeries({});
    expect(result).toEqual([]);
  });

  it("should normalize and align series", () => {
    const seriesBySymbol = {
      AAPL: [
        { date: "2024-01-01", close: 100 },
        { date: "2024-01-02", close: 110 },
      ],
      MSFT: [
        { date: "2024-01-01", close: 200 },
        { date: "2024-01-02", close: 210 },
      ],
    };

    const result = computePortfolioSeries(seriesBySymbol);
    expect(result).toHaveLength(2);
    expect(result[0].close).toBeCloseTo(1);
    expect(result[1].close).toBeGreaterThan(1);
  });
});

describe("computePortfolioMetrics", () => {
  it("should handle short series", () => {
    const result = computePortfolioMetrics([{ date: "2024-01-01", close: 1 }]);
    expect(result.sharpe).toBeNull();
    expect(result.volatility).toBeNull();
  });

  it("should compute metrics for longer series", () => {
    const series = [
      { date: "2024-01-01", close: 1 },
      { date: "2024-01-02", close: 1.02 },
      { date: "2024-01-03", close: 1.05 },
    ];
    const result = computePortfolioMetrics(series);
    expect(result.returns.length).toBeGreaterThan(0);
    expect(result.totalReturn).not.toBeNull();
  });
});

describe("backtestBuyAndHold", () => {
  it("should return empty result for empty series", () => {
    const result = backtestBuyAndHold([]);
    expect(result.equityCurve).toEqual([]);
  });

  it("should produce positive return for rising prices", () => {
    const series = [
      { date: "2024-01-01", close: 100 },
      { date: "2024-01-02", close: 120 },
    ];
    const result = backtestBuyAndHold(series);
    expect(result.totalReturn).toBeCloseTo(0.2, 5);
    expect(result.trades).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeCapmStats Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeCapmStats", () => {
  it("should compute beta, alpha, and r2 for aligned series", () => {
    const benchmarkReturns = [Math.log(1.1), Math.log(0.95), Math.log(1.08), Math.log(0.97)];
    const betaTrue = 1.2;
    const alphaTrue = 0.001;
    const assetReturns = benchmarkReturns.map((r) => alphaTrue + betaTrue * r);

    const benchmarkSeries = createCloseSeriesFromLogReturns(benchmarkReturns);
    const assetSeries = createCloseSeriesFromLogReturns(assetReturns);

    const stats = computeCapmStats(assetSeries, benchmarkSeries);

    expect(stats.beta).not.toBeNull();
    expect(stats.beta).toBeCloseTo(betaTrue, 5);
    expect(stats.alphaDaily).not.toBeNull();
    expect(stats.alphaDaily).toBeCloseTo(alphaTrue, 5);
    expect(stats.alphaAnnual).not.toBeNull();
    expect(stats.alphaAnnual).toBeCloseTo(alphaTrue * 252, 5);
    expect(stats.r2).not.toBeNull();
    expect(stats.r2).toBeCloseTo(1, 5);
  });

  it("should return null metrics when insufficient data", () => {
    const asset = [{ date: "2024-01-01", close: 100 }];
    const benchmark = [{ date: "2024-01-01", close: 100 }];

    const stats = computeCapmStats(asset, benchmark);

    expect(stats.beta).toBeNull();
    expect(stats.alphaDaily).toBeNull();
    expect(stats.alphaAnnual).toBeNull();
    expect(stats.r2).toBeNull();
  });

  it("should return null metrics when benchmark variance is zero", () => {
    const asset = createCloseSeriesFromLogReturns([Math.log(1.05), Math.log(0.98), Math.log(1.02)]);
    const constantBenchmarkSeries = createSeries([100, 100, 100, 100]).map((point) => ({
      date: point.date,
      close: point.close,
    }));

    const stats = computeCapmStats(asset, constantBenchmarkSeries);

    expect(stats.beta).toBeNull();
    expect(stats.alphaDaily).toBeNull();
    expect(stats.alphaAnnual).toBeNull();
    expect(stats.r2).toBeNull();
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
