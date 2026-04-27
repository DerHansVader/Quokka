/**
 * Helpers for computing the closest *line* (not data point) to a cursor.
 *
 * uPlot exposes only a snapped x-data-index. With sparse data, the visible
 * line at the cursor's actual x is interpolated between the two bracketing
 * samples — so to find which line the cursor is *visually* closest to we
 * need to evaluate each series' line segment that crosses the cursor's x.
 */

const isFiniteNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** Find the y of `series` at `cursorX` by linearly interpolating between
 *  the nearest valid samples on each side of the cursor.
 *
 *  Returns `null` when the cursor is outside the run's data range — i.e.
 *  there is no line segment crossing `cursorX` to be near. This matters
 *  for sparse runs that end before / start after the cursor: a snapped
 *  endpoint should NOT win the closeness contest there.
 */
export function lineYAt(
  ys: ArrayLike<number | null | undefined>,
  xs: ArrayLike<number>,
  cursorX: number,
  hint: number,
): number | null {
  const n = xs.length;
  if (n === 0) return null;

  // Walk left from `hint` for the largest valid index with x <= cursorX.
  let lo = -1;
  for (let k = Math.min(hint, n - 1); k >= 0; k--) {
    if (xs[k] <= cursorX && isFiniteNum(ys[k])) { lo = k; break; }
  }
  // Walk right for the smallest valid index with x >= cursorX.
  let hi = -1;
  for (let k = Math.max(hint, 0); k < n; k++) {
    if (xs[k] >= cursorX && isFiniteNum(ys[k])) { hi = k; break; }
  }

  // Cursor on an exact valid sample.
  if (lo === hi && lo !== -1) return ys[lo] as number;

  // Cursor is outside the run's data range — no line to compare against.
  if (lo === -1 || hi === -1) return null;

  const x0 = xs[lo];
  const x1 = xs[hi];
  const y0 = ys[lo] as number;
  const y1 = ys[hi] as number;
  if (x1 === x0) return y0;

  const t = (cursorX - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}
