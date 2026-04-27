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

  it('returns the anchor when there is no second valid sample', () => {
    const xs = [0];
    const ys = [42];
    expect(lineYAt(ys, xs, 99, 0)).toBe(42);
  });

  it('returns null when the series has no finite samples', () => {
    const xs = [0, 10];
    const ys = [null, NaN];
    expect(lineYAt(ys, xs, 5, 0)).toBeNull();
  });

  it('walks left when the cursor is to the left of the hint', () => {
    const xs = [0, 10, 20];
    const ys = [0, 10, 20];
    expect(lineYAt(ys, xs, 5, 1)).toBe(5);
  });
});
