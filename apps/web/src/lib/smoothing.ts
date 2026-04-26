import type { SmoothingType } from '@quokka/shared';

/**
 * Smooths a series.
 *
 * Strength-based (0..1, 0 is pass-through):
 *   - `ema`       debiased exponential moving average (wandb / TensorBoard)
 *   - `dema`      double EMA: 2·EMA − EMA(EMA), lag-reduced
 *   - `gaussian`  truncated, per-point renormalized Gaussian kernel
 *
 * Window-based (`window` = total span; radius = ⌊window / 2⌋; 0 is pass-through):
 *   - `sma`     simple moving average
 *   - `median`  moving median (robust to single-point outliers)
 *   - `savgol`  Savitzky–Golay cubic: local polynomial fit, shape-preserving
 *
 * NaN values pass through unchanged and never contaminate the output.
 */
export function smooth(
  values: number[],
  type: SmoothingType,
  strength: number,
  window = 0,
): number[] {
  if (type === 'none' || values.length <= 1) return values;

  if (isWindowType(type)) {
    const radius = Math.floor(Math.max(0, window) / 2);
    if (radius <= 0) return values;
    if (type === 'sma')    return smaSmooth(values, radius);
    if (type === 'median') return medianSmooth(values, radius);
    if (type === 'savgol') return radius >= 2 ? savgolSmooth(values, radius, 3) : values;
  }

  if (strength <= 0) return values;
  const s = Math.min(0.999, Math.max(0, strength));
  if (type === 'ema')      return emaSmooth(values, s);
  if (type === 'dema')     return demaSmooth(values, s);
  if (type === 'gaussian') return gaussianSmooth(values, s);
  return values;
}

const WINDOW_TYPES: ReadonlySet<SmoothingType> = new Set([
  'sma', 'median', 'savgol',
]);

export function isWindowType(type: SmoothingType): boolean {
  return WINDOW_TYPES.has(type);
}

// ─── strength-based ────────────────────────────────────────────────────

/** Debiased EMA: smoothed[i] = weighted mean of past values, geometric decay. */
function emaSmooth(values: number[], s: number): number[] {
  const result = new Array<number>(values.length);
  let accum = 0;
  let weight = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      result[i] = v;
      continue;
    }
    accum = accum * s + (1 - s) * v;
    weight = weight * s + (1 - s);
    result[i] = accum / weight;
  }
  return result;
}

/** Double EMA: 2·EMA − EMA(EMA). Same smoothness with markedly less lag. */
function demaSmooth(values: number[], s: number): number[] {
  const e1 = emaSmooth(values, s);
  const e2 = emaSmooth(e1, s);
  return values.map((v, i) =>
    Number.isFinite(v) ? 2 * e1[i] - e2[i] : v,
  );
}

/** Truncated Gaussian convolution with per-point renormalization. */
function gaussianSmooth(values: number[], s: number): number[] {
  const MAX_RADIUS = 50;
  const radius = Math.max(1, Math.round(s * MAX_RADIUS));
  const sigma = Math.max(0.5, radius / 2);
  const result = new Array<number>(values.length);

  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      result[i] = values[i];
      continue;
    }
    let sum = 0;
    let weightSum = 0;
    const lo = Math.max(0, i - radius);
    const hi = Math.min(values.length - 1, i + radius);
    for (let j = lo; j <= hi; j++) {
      const v = values[j];
      if (!Number.isFinite(v)) continue;
      const w = Math.exp(-0.5 * ((j - i) / sigma) ** 2);
      sum += v * w;
      weightSum += w;
    }
    result[i] = weightSum > 0 ? sum / weightSum : values[i];
  }
  return result;
}

// ─── window-based ──────────────────────────────────────────────────────

/** Simple moving average over [i-radius, i+radius]. */
function smaSmooth(values: number[], radius: number): number[] {
  return windowMap(values, radius, (_center, win) => {
    let sum = 0;
    for (const v of win) sum += v;
    return sum / win.length;
  });
}

/** Moving median, boundary-clipped. */
function medianSmooth(values: number[], radius: number): number[] {
  return windowMap(values, radius, (_center, win) => {
    const sorted = [...win].sort((a, b) => a - b);
    return median(sorted);
  });
}

/**
 * Savitzky–Golay: fits a degree-`p` polynomial by least squares to the window
 * and evaluates it at the center. Preserves peak height and curvature much
 * better than a flat average.
 */
function savgolSmooth(values: number[], radius: number, p: number): number[] {
  const n = values.length;
  const result = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(values[i])) {
      result[i] = values[i];
      continue;
    }
    const lo = Math.max(0, i - radius);
    const hi = Math.min(n - 1, i + radius);
    const ts: number[] = [];
    const ys: number[] = [];
    for (let j = lo; j <= hi; j++) {
      const v = values[j];
      if (Number.isFinite(v)) {
        ts.push(j - i);
        ys.push(v);
      }
    }
    const deg = Math.min(p, ts.length - 1);
    result[i] = deg >= 0 ? polyFitAtZero(ts, ys, deg) : values[i];
  }
  return result;
}

// ─── helpers ───────────────────────────────────────────────────────────

/** Apply `fn(centerValue, finiteWindow)` to every finite point. */
function windowMap(
  values: number[],
  radius: number,
  fn: (center: number, win: number[]) => number,
): number[] {
  const n = values.length;
  const result = new Array<number>(n);
  const win: number[] = [];
  for (let i = 0; i < n; i++) {
    const center = values[i];
    if (!Number.isFinite(center)) {
      result[i] = center;
      continue;
    }
    win.length = 0;
    const lo = Math.max(0, i - radius);
    const hi = Math.min(n - 1, i + radius);
    for (let j = lo; j <= hi; j++) {
      const v = values[j];
      if (Number.isFinite(v)) win.push(v);
    }
    result[i] = win.length === 0 ? center : fn(center, win);
  }
  return result;
}

function median(sorted: number[]): number {
  const m = sorted.length;
  return m % 2 ? sorted[(m - 1) >> 1] : (sorted[m / 2 - 1] + sorted[m / 2]) / 2;
}

/** Least-squares poly fit on (ts, ys); returns the value at t = 0. */
function polyFitAtZero(ts: number[], ys: number[], deg: number): number {
  const m = deg + 1;
  const A: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const b: number[] = new Array<number>(m).fill(0);

  const pows = new Array<number>(2 * m - 1);
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    let p = 1;
    for (let k = 0; k < pows.length; k++) { pows[k] = p; p *= t; }
    for (let j = 0; j < m; j++) {
      b[j] += ys[i] * pows[j];
      for (let k = 0; k < m; k++) A[j][k] += pows[j + k];
    }
  }

  // Gaussian elimination with partial pivoting; we only need β₀.
  for (let col = 0; col < m; col++) {
    let piv = col;
    for (let r = col + 1; r < m; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    }
    if (piv !== col) {
      [A[col], A[piv]] = [A[piv], A[col]];
      [b[col], b[piv]] = [b[piv], b[col]];
    }
    const d = A[col][col];
    if (Math.abs(d) < 1e-12) return ys[ys.length >> 1];
    for (let r = col + 1; r < m; r++) {
      const f = A[r][col] / d;
      for (let k = col; k < m; k++) A[r][k] -= f * A[col][k];
      b[r] -= f * b[col];
    }
  }
  const beta = new Array<number>(m).fill(0);
  for (let i = m - 1; i >= 0; i--) {
    let sum = b[i];
    for (let k = i + 1; k < m; k++) sum -= A[i][k] * beta[k];
    beta[i] = sum / A[i][i];
  }
  return beta[0];
}

// ─── outlier pre-filter (unchanged) ────────────────────────────────────

/**
 * Drops values outside the lower/upper `pct` percentiles.
 * Dropped points become NaN so they create gaps in the plot.
 */
export function excludeOutliers(
  values: number[],
  pct: number,
): { filtered: number[]; mask: boolean[] } {
  if (pct <= 0) return { filtered: values, mask: values.map(() => true) };

  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (finite.length === 0) {
    return { filtered: values, mask: values.map(() => true) };
  }
  const loIdx = Math.floor((pct / 100) * finite.length);
  const hiIdx = Math.min(finite.length - 1, Math.floor((1 - pct / 100) * finite.length));
  const lo = finite[loIdx];
  const hi = finite[hiIdx];

  const mask = values.map((v) => Number.isFinite(v) && v >= lo && v <= hi);
  const filtered = values.map((v, i) => (mask[i] ? v : NaN));
  return { filtered, mask };
}
