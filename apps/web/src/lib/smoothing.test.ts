import { describe, expect, it } from 'vitest';
import { smooth, excludeOutliers } from './smoothing';

function variance(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
}

describe('smooth', () => {
  const noisy = Array.from({ length: 200 }, (_, i) =>
    Math.sin(i / 10) + (i % 2 === 0 ? 0.5 : -0.5),
  );

  it('returns input unchanged when type is "none"', () => {
    expect(smooth([1, 2, 3], 'none', 0.9)).toEqual([1, 2, 3]);
  });

  it('returns input unchanged when strength is 0', () => {
    expect(smooth(noisy, 'ema', 0)).toEqual(noisy);
    expect(smooth(noisy, 'gaussian', 0)).toEqual(noisy);
  });

  it('returns input unchanged for single-point series', () => {
    expect(smooth([42], 'ema', 0.9)).toEqual([42]);
  });

  describe('EMA', () => {
    it('does not bias the first point toward zero (debiased)', () => {
      const out = smooth([10, 10, 10, 10], 'ema', 0.9);
      out.forEach((v) => expect(v).toBeCloseTo(10, 10));
    });

    it('reduces variance monotonically as strength grows', () => {
      const varRaw = variance(noisy);
      const varLow = variance(smooth(noisy, 'ema', 0.3));
      const varMid = variance(smooth(noisy, 'ema', 0.7));
      const varHigh = variance(smooth(noisy, 'ema', 0.95));
      expect(varLow).toBeLessThan(varRaw);
      expect(varMid).toBeLessThan(varLow);
      expect(varHigh).toBeLessThan(varMid);
    });

    it('converges to a constant input', () => {
      const out = smooth([5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 'ema', 0.9);
      out.forEach((v) => expect(v).toBeCloseTo(5, 10));
    });

    it('first smoothed value equals the first input (no leading bias)', () => {
      const out = smooth([7, 3, 9, 1], 'ema', 0.8);
      expect(out[0]).toBeCloseTo(7, 10);
    });

    it('passes NaN through without corrupting surrounding output', () => {
      const out = smooth([1, 2, NaN, 4, 5], 'ema', 0.7);
      expect(Number.isNaN(out[2])).toBe(true);
      expect(Number.isFinite(out[0])).toBe(true);
      expect(Number.isFinite(out[1])).toBe(true);
      expect(Number.isFinite(out[3])).toBe(true);
    });

    it('higher strength produces slower response to a step', () => {
      const step = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
      const light = smooth(step, 'ema', 0.2);
      const heavy = smooth(step, 'ema', 0.9);
      expect(heavy[5]).toBeLessThan(light[5]);
    });
  });

  describe('Gaussian', () => {
    it('reduces variance monotonically as strength grows', () => {
      const varRaw = variance(noisy);
      const varLow = variance(smooth(noisy, 'gaussian', 0.1));
      const varMid = variance(smooth(noisy, 'gaussian', 0.5));
      const varHigh = variance(smooth(noisy, 'gaussian', 0.95));
      expect(varLow).toBeLessThan(varRaw);
      expect(varMid).toBeLessThan(varLow);
      expect(varHigh).toBeLessThan(varMid);
    });

    it('preserves a constant input', () => {
      const out = smooth([3, 3, 3, 3, 3, 3, 3], 'gaussian', 0.8);
      out.forEach((v) => expect(v).toBeCloseTo(3, 10));
    });

    it('does not collapse edges (no reflection, renormalized kernel)', () => {
      const out = smooth([10, 10, 10, 10, 10], 'gaussian', 0.9);
      out.forEach((v) => expect(v).toBeCloseTo(10, 6));
    });

    it('skips NaN values but keeps indices aligned', () => {
      const out = smooth([1, NaN, 1, 1, 1], 'gaussian', 0.5);
      expect(Number.isNaN(out[1])).toBe(true);
      expect(out).toHaveLength(5);
      out
        .filter((_, i) => i !== 1)
        .forEach((v) => expect(v).toBeCloseTo(1, 6));
    });
  });
});

describe('excludeOutliers', () => {
  it('is a no-op at 0%', () => {
    const { filtered, mask } = excludeOutliers([1, 2, 3, 100], 0);
    expect(filtered).toEqual([1, 2, 3, 100]);
    expect(mask).toEqual([true, true, true, true]);
  });

  it('drops extreme values at the tails', () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    values.push(9999);
    values.unshift(-9999);
    const { mask } = excludeOutliers(values, 2);
    expect(mask[0]).toBe(false);
    expect(mask[mask.length - 1]).toBe(false);
    expect(mask[50]).toBe(true);
  });

  it('replaces dropped values with NaN so plots show gaps', () => {
    const values = [...Array.from({ length: 20 }, (_, i) => i + 1), 99999, -99999];
    const { filtered } = excludeOutliers(values, 5);
    expect(Number.isNaN(filtered[20])).toBe(true);
    expect(Number.isNaN(filtered[21])).toBe(true);
    expect(Number.isFinite(filtered[10])).toBe(true);
  });
});
