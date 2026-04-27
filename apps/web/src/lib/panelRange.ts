/** Range callback for uPlot scales that:
 *  - lets the user override only one bound (the other auto-fits to data),
 *  - never returns a non-positive lo on a log axis (which freezes uPlot), and
 *  - skips uPlot's default power-of-10 padding so log auto-fits tightly to data.
 */
export function buildRange(
  log: boolean,
  userMin: number | null | undefined,
  userMax: number | null | undefined,
) {
  return (_u: unknown, dMin: number | null, dMax: number | null): [number, number] => {
    const fbLo = log ? 1 : 0;
    const fbHi = log ? 10 : 1;
    let lo = userMin != null ? userMin
      : dMin != null && Number.isFinite(dMin) ? dMin : fbLo;
    let hi = userMax != null ? userMax
      : dMax != null && Number.isFinite(dMax) ? dMax : fbHi;

    if (log) {
      if (lo <= 0) lo = dMin != null && dMin > 0 ? dMin : 1e-9;
      if (hi <= lo) hi = lo * 10;
    } else if (hi <= lo) {
      hi = lo + (Math.abs(lo) || 1);
    }
    return [lo, hi];
  };
}
