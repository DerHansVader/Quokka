import { describe, expect, it } from 'vitest';
import { alignRunValues, plotValues } from './panelData';

describe('Panel comparison alignment', () => {
  it('keeps runs drawable when they never share exact x coordinates', () => {
    const xs = [0, 5, 10, 15, 20, 25];
    const runA = alignRunValues(xs, [
      { x: 0, y: 1 },
      { x: 10, y: 0.8 },
      { x: 20, y: 0.6 },
    ]);
    const runB = alignRunValues(xs, [
      { x: 5, y: 1.1 },
      { x: 15, y: 0.9 },
      { x: 25, y: 0.7 },
    ]);

    expect(plotValues(runA)).toEqual([1, null, 0.8, null, 0.6, null]);
    expect(plotValues(runB)).toEqual([null, 1.1, null, 0.9, null, 0.7]);
  });

  it('turns filtered or missing values into uPlot gaps instead of NaN', () => {
    expect(plotValues([1, NaN, Infinity, -Infinity, 2])).toEqual([
      1,
      null,
      null,
      null,
      2,
    ]);
  });
});
