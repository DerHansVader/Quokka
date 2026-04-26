export type Role = 'owner' | 'admin' | 'member';

export type RunStatus = 'running' | 'finished' | 'crashed';

export type ScaleType = 'linear' | 'log';

export type SmoothingType =
  | 'none'
  | 'ema'
  | 'dema'
  | 'gaussian'
  | 'sma'
  | 'median'
  | 'savgol';

/** Built-in X axes; anything else is treated as a metric key. */
export const X_AXIS_BUILTINS = ['step', 'relativeTime', 'wallTime'] as const;
export type XAxisBuiltin = (typeof X_AXIS_BUILTINS)[number];

export interface PanelConfig {
  keys: string[];
  runs?: string[];
  /**
   * `strength` is 0..1 for EMA / DEMA / Gaussian.
   * `window` is the total span (radius = window/2) for SMA / Median /
   * Savitzky–Golay.
   */
  smoothing: { type: SmoothingType; strength: number; window?: number };
  /** When smoothing is active, also draw the raw line underneath at low opacity. */
  showRaw?: boolean;
  outlier: { pct: number };
  xScale: ScaleType;
  yScale: ScaleType;
  xDomain?: [number, number];
  yDomain?: [number, number];
  /** `step` | `relativeTime` | `wallTime` | any metric key. Default `step`. */
  xAxis?: string;
}

export interface MetricPoint {
  step: number;
  value: number;
  wallTime: string;
}

export interface Series {
  key: string;
  runId: string;
  points: MetricPoint[];
}

export interface LogBatchItem {
  key: string;
  step: number;
  value: number;
  wallTime?: string;
}
