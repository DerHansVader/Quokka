/**
 * Helpers for computing the closest *line* (not data point) to a cursor.
 *
 * uPlot exposes only a snapped x-data-index. With sparse data, the visible
 * line at the cursor's actual x is interpolated between the two bracketing
 * points — so to find which line the cursor is *visually* closest to we
 * need to evaluate each series' line segment that crosses the cursor's x.
 */

/** Find the y at the line position for `cursorX`, by linearly interpolating
 *  between the two valid samples that bracket the cursor.
 *  Returns `null` if the series has no usable samples near the cursor.
 */
export function lineYAt(
  ys: ArrayLike<number | null | undefined>,
  xs: ArrayLike<number>,
  cursorX: number,
  hint: number,
): number | null {
  const n = xs.length;
  if (n === 0) return null;

  const isFinite = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);

  // Anchor: if the hint is on a valid sample use it, otherwise find the
  // nearest valid sample by x.
  let anchor = hint;
  if (!isFinite(ys[anchor])) {
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < n; k++) {
      if (!isFinite(ys[k])) continue;
      const d = Math.abs(xs[k] - cursorX);
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best < 0) return null;
    anchor = best;
  }

  const x0 = xs[anchor];
  const y0 = ys[anchor] as number;

  // Walk in the direction of the cursor for the second valid sample.
  const dir = cursorX >= x0 ? 1 : -1;
  let x1: number | null = null;
  let y1: number | null = null;
  for (let k = anchor + dir; k >= 0 && k < n; k += dir) {
    if (isFinite(ys[k])) { x1 = xs[k]; y1 = ys[k] as number; break; }
  }

  if (x1 == null || y1 == null || x1 === x0) return y0;

  const t = (cursorX - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}
