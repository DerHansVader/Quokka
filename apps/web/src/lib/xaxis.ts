import type { MetricPoint } from '@quokka/shared';

export const X_AXIS_LABELS: Record<string, string> = {
  step: 'Step',
  relativeTime: 'Relative time (s)',
  wallTime: 'Wall time',
};

const BUILTINS = new Set(['step', 'relativeTime', 'wallTime']);
export const isBuiltinXAxis = (x: string) => BUILTINS.has(x);

/**
 * Converts metric points into (x, y) pairs according to the chosen x-axis.
 * For a metric-key x-axis, `xMap` maps step → metric value for the same run.
 */
export function resolveXY(
  points: MetricPoint[],
  xAxis: string,
  xMap?: Map<number, number>,
): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const t0 = new Date(points[0].wallTime).getTime() / 1000;

  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    let x: number;
    if (xAxis === 'step') x = p.step;
    else if (xAxis === 'wallTime') x = new Date(p.wallTime).getTime() / 1000;
    else if (xAxis === 'relativeTime') x = new Date(p.wallTime).getTime() / 1000 - t0;
    else x = xMap?.get(p.step) ?? NaN;
    if (Number.isFinite(x)) out.push({ x, y: p.value });
  }
  return out;
}
