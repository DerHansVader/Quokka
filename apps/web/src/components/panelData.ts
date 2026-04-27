import type { RunSeriesEntry } from './Panel';

export const plotValues = (values: number[]) =>
  values.map((v) => (Number.isFinite(v) ? v : null));

export const alignRunValues = (xs: number[], points: RunSeriesEntry['points']) => {
  const map = new Map(points.map((p) => [p.x, p.y]));
  return xs.map((x) => map.get(x) ?? NaN);
};
