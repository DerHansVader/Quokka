import { describe, expect, it } from 'vitest';
import { buildRange } from './panelRange';

const u = null as unknown;

describe('buildRange', () => {
  it('falls back to data extent when no user bound is given', () => {
    expect(buildRange(false, null, null)(u, 0, 5)).toEqual([0, 5]);
  });

  it('honours a single user bound and auto-fits the other', () => {
    expect(buildRange(false, 2, null)(u, 0, 100)).toEqual([2, 100]);
    expect(buildRange(false, null, 50)(u, 0, 100)).toEqual([0, 50]);
  });

  it('honours both user bounds when present', () => {
    expect(buildRange(false, 0, 5)(u, -100, 1000)).toEqual([0, 5]);
  });

  it('never returns a non-positive lo on a log axis (freeze guard)', () => {
    const r = buildRange(true, 0, 5)(u, 0.5, 1000);
    expect(r[0]).toBe(0.5);
    expect(r[1]).toBe(5);
  });

  it('clamps lo to a tiny positive when no positive data exists on a log axis', () => {
    const r = buildRange(true, 0, 5)(u, 0, 100);
    expect(r[0]).toBeGreaterThan(0);
    expect(r[1]).toBe(5);
  });

  it('does not pad to powers of 10 on log auto-fit', () => {
    const r = buildRange(true, null, null)(u, 1, 20);
    expect(r).toEqual([1, 20]);
  });

  it('expands hi when it ends up <= lo', () => {
    expect(buildRange(false, 5, 5)(u, 0, 0)).toEqual([5, 10]);
    expect(buildRange(true, 1, 1)(u, 1, 1)).toEqual([1, 10]);
  });

  it('falls back gracefully when data bounds are non-finite or null', () => {
    expect(buildRange(false, null, null)(u, null, null)).toEqual([0, 1]);
    expect(buildRange(true, null, null)(u, null, null)).toEqual([1, 10]);
    expect(buildRange(false, null, null)(u, NaN, NaN)).toEqual([0, 1]);
  });
});
