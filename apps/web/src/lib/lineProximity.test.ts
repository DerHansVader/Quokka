import { describe, it, expect } from 'vitest';
import { lineYAt } from './lineProximity';

describe('lineYAt', () => {
  it('returns the exact y when the cursor lands on a sample', () => {
    const xs = [0, 10, 20];
    const ys = [1, 5, 9];
    expect(lineYAt(ys, xs, 10, 1)).toBe(5);
  });

  it('linearly interpolates between adjacent samples', () => {
    const xs = [0, 10];
    const ys = [0, 10];
    expect(lineYAt(ys, xs, 5, 0)).toBe(5);
    expect(lineYAt(ys, xs, 7.5, 0)).toBe(7.5);
  });

  it('skips null/NaN gaps and bridges across them', () => {
    const xs = [0, 10, 20, 30];
    const ys = [0, null, null, 30];
    expect(lineYAt(ys, xs, 15, 0)).toBeCloseTo(15, 6);
  });

  it('returns null when the cursor is outside the run data range', () => {
    const xs = [0, 10, 20];
    const ys = [0, 10, 20];
    // Beyond the rightmost sample — no line is drawn there.
    expect(lineYAt(ys, xs, 99, 2)).toBeNull();
    // Before the leftmost sample — no line either.
    expect(lineYAt(ys, xs, -5, 0)).toBeNull();
  });

  it('returns null when the series has only one sample (no line, only a point)', () => {
    expect(lineYAt([42], [0], 0, 0)).toBe(42);
    expect(lineYAt([42], [0], 99, 0)).toBeNull();
  });

  it('returns null when the series has no finite samples', () => {
    const xs = [0, 10];
    const ys = [null, NaN];
    expect(lineYAt(ys, xs, 5, 0)).toBeNull();
  });

  it('walks left when the cursor is to the left of the hint', () => {
    const xs = [0, 10, 20];
    const ys = [0, 10, 20];
    expect(lineYAt(ys, xs, 5, 2)).toBe(5);
  });

  it('bridges sparse runs across many union x positions', () => {
    // Run only has samples at x=0 and x=1000; union has many in between.
    const xs = [0, 250, 500, 750, 1000];
    const ys = [0, null, null, null, 1000];
    expect(lineYAt(ys, xs, 250, 1)).toBeCloseTo(250, 6);
    expect(lineYAt(ys, xs, 500, 2)).toBeCloseTo(500, 6);
    expect(lineYAt(ys, xs, 750, 3)).toBeCloseTo(750, 6);
  });
});
