import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { PanelConfig } from '@quokka/shared';
import { smooth, excludeOutliers, isWindowType } from '../lib/smoothing';
import { alignRunValues, plotValues } from './panelData';
import { buildRange } from '../lib/panelRange';
import { lineYAt } from '../lib/lineProximity';
import { useHoverStore } from '../stores/hover';
import { useSamplePeekStore } from '../stores/samplePeek';
import s from './Panel.module.css';

const SYNC_KEY = 'wt-panels';
const DEFAULT_HEIGHT = 240;
const STROKE_NORMAL = 1.75;
const STROKE_HIGHLIGHT = 2.75;
const STROKE_DIM_ALPHA = 0.18;

export interface RunSeriesEntry {
  runId: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
  /** When false, the series is registered but hidden — toggled live without rebuild. */
  visible?: boolean;
}

interface PanelProps {
  config: PanelConfig;
  runs: RunSeriesEntry[];
  /** Fixed pixel height. Ignored when `fill` is true. */
  height?: number;
  /** Take height from the parent container instead of the `height` prop. */
  fill?: boolean;
}

const fmt = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : '--';

const withAlpha = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');


export function Panel({ config, runs, height = DEFAULT_HEIGHT, fill = false }: PanelProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  /** Index in `runs` whose line the cursor is closest to. -1 when off-chart. */
  const closestRef = useRef<number>(-1);
  /** Stable references to the *current* runs array — used by hooks
   *  that should not retrigger plot rebuilds when only visibility/hover change. */
  const runsRef = useRef(runs);
  runsRef.current = runs;

  const setHoveredRun = useHoverStore((s) => s.setRunId);
  const hoveredRunId = useHoverStore((s) => s.runId);
  const openSamplePeek = useSamplePeekStore((s) => s.open);

  // (re)build the plot when data or visual config changes.
  // NOTE: We deliberately exclude `runs[i].visible` from this dependency: it's
  // applied later via `setSeries(i, { show })` so toggling visibility doesn't
  // tear down and rebuild the entire chart.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || runs.length === 0) return;

    const allX = new Set<number>();
    for (const r of runs) for (const p of r.points) allX.add(p.x);
    const xs = [...allX].sort((a, b) => a - b);

    const { type: smType, strength: smStrength, window: smWindow = 0 } = config.smoothing;
    const smoothingOn =
      smType !== 'none' &&
      (isWindowType(smType) ? Math.floor(smWindow / 2) > 0 : smStrength > 0);
    const drawRaw = smoothingOn && config.showRaw !== false;

    const rawByRun = runs.map((r) => {
      let values = alignRunValues(xs, r.points);
      if (config.outlier.pct > 0) values = excludeOutliers(values, config.outlier.pct).filtered;
      return values;
    });

    const smoothedByRun = rawByRun.map((raw) =>
      smoothingOn ? smooth(raw, smType, smStrength, smWindow) : raw,
    );

    const data: uPlot.AlignedData = [
      new Float64Array(xs),
      ...(drawRaw ? rawByRun.map(plotValues) : []),
      ...smoothedByRun.map(plotValues),
    ];

    const rawSeries = drawRaw
      ? runs.map((r) => ({
          label: r.label + ' (raw)',
          stroke: withAlpha(r.color, 0.14),
          width: 0.75,
          spanGaps: true,
          points: { show: false },
          show: r.visible !== false,
        }))
      : [];

    const mainSeries = runs.map((r) => ({
      label: r.label,
      stroke: r.color,
      width: STROKE_NORMAL,
      spanGaps: true,
      points: { show: false },
      show: r.visible !== false,
    }));

    const isTime = config.xAxis === 'wallTime';
    const formatX = (v: number) =>
      isTime ? new Date(v * 1000).toLocaleString() : fmt(v);

    const smoothedStart = 1 + (drawRaw ? runs.length : 0);

    const axisFont =
      '11px Satoshi, -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
    const xAxis = {
      stroke: '#8a8a92',
      grid: { stroke: 'rgba(255,255,255,0.035)', width: 1 },
      ticks: { stroke: 'rgba(255,255,255,0.05)', width: 1, size: 3 },
      font: axisFont,
      size: 24,
      gap: 3,
    };
    const yAxis = {
      stroke: '#8a8a92',
      grid: { stroke: 'rgba(255,255,255,0.035)', width: 1 },
      ticks: { stroke: 'rgba(255,255,255,0.05)', width: 1, size: 3 },
      font: axisFont,
      size: 38,
      gap: 3,
    };

    const wrap = wrapRef.current;
    const width = Math.max(1, host.clientWidth);
    const effectiveHeight = fill && wrap ? Math.max(1, wrap.clientHeight) : height;

    const xLog = config.xScale === 'log';
    const yLog = config.yScale === 'log';

    const opts: uPlot.Options = {
      width,
      height: effectiveHeight,
      legend: { show: false },
      padding: [8, 10, 0, 0],
      cursor: {
        x: true,
        y: false,
        drag: { x: true, y: false },
        sync: { key: SYNC_KEY },
        points: { size: 5 },
      },
      scales: {
        x: {
          distr: xLog ? 3 : 1,
          time: isTime,
          range: buildRange(xLog, config.xDomain?.[0], config.xDomain?.[1]),
        },
        y: {
          distr: yLog ? 3 : 1,
          range: buildRange(yLog, config.yDomain?.[0], config.yDomain?.[1]),
        },
      },
      axes: [xAxis, yAxis],
      series: [{ label: 'X' }, ...rawSeries, ...mainSeries],
      hooks: {
        setCursor: [
          (u) => {
            const tip = tipRef.current;
            if (!tip) return;
            const idx = u.cursor.idx;
            const cy = u.cursor.top ?? -1;
            const x = idx != null && idx >= 0 ? u.data[0][idx] : null;
            if (x == null || !Number.isFinite(x) || cy < 0) {
              tip.style.display = 'none';
              closestRef.current = -1;
              setHoveredRun(null);
              return;
            }

            // Find which *line* is closest to the cursor by interpolating
            // each series at the cursor's x and comparing pixel distance —
            // the snapped data-point alone is misleading on sparse traces.
            const cursorX = u.posToVal(u.cursor.left ?? 0, 'x');
            const xs = u.data[0] as unknown as number[];
            let closest = -1;
            let best = Infinity;
            for (let i = 0; i < runsRef.current.length; i++) {
              if (runsRef.current[i].visible === false) continue;
              const ys = u.data[smoothedStart + i] as unknown as
                | ArrayLike<number | null | undefined>
                | undefined;
              if (!ys) continue;
              const yLine = lineYAt(ys, xs, cursorX, idx!);
              if (yLine == null || !Number.isFinite(yLine)) continue;
              const py = u.valToPos(yLine, 'y');
              const d = Math.abs(py - cy);
              if (d < best) { best = d; closest = i; }
            }
            if (closest !== closestRef.current) {
              closestRef.current = closest;
              setHoveredRun(closest >= 0 ? runsRef.current[closest].runId : null);
            }

            const rows = runsRef.current
              .map((r, i) => {
                if (r.visible === false) return '';
                const y = u.data[smoothedStart + i]?.[idx!];
                const cls = s.tipRow + (i === closest ? ' ' + s.tipRowActive : '');
                return (
                  `<div class="${cls}">` +
                  `<span class="${s.tipSwatch}" style="background:${r.color}"></span>` +
                  `<span class="${s.tipName}">${esc(r.label)}</span>` +
                  `<span class="${s.tipValue}">${fmt(y)}</span>` +
                  `</div>`
                );
              })
              .join('');
            tip.innerHTML =
              `<div class="${s.tipHead}">${esc(formatX(x as number))}</div>` + rows;
            tip.style.display = 'block';

            // Position the tooltip in *viewport* coordinates so it can extend
            // outside of the panel without ever getting clipped.
            const root = u.root.getBoundingClientRect();
            const left = u.cursor.left ?? 0;
            const top = cy;
            const off = 12;
            const tipW = tip.offsetWidth;
            const tipH = tip.offsetHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let x1 = root.left + left + off;
            if (x1 + tipW > vw - 8) x1 = root.left + left - tipW - off;
            if (x1 < 8) x1 = 8;
            let y1 = root.top + top + off;
            if (y1 + tipH > vh - 8) y1 = vh - tipH - 8;
            if (y1 < 8) y1 = 8;
            tip.style.left = x1 + 'px';
            tip.style.top = y1 + 'px';
          },
        ],
      },
    };

    plotRef.current?.destroy();
    plotRef.current = new uPlot(opts, data, host);

    return () => {
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [runs, config, height, fill]);

  // observe size and resize the plot in place (width + height)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const ro = new ResizeObserver(() => {
      const plot = plotRef.current;
      if (!plot) return;
      const w = Math.max(1, wrap.clientWidth);
      const h = fill ? Math.max(1, wrap.clientHeight) : height;
      if (w !== plot.width || h !== plot.height) {
        plot.setSize({ width: w, height: h });
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [height, fill]);

  // Toggle series visibility live (no plot rebuild).
  useEffect(() => {
    const u = plotRef.current;
    if (!u) return;
    const drawRaw = config.smoothing.type !== 'none' && config.showRaw !== false;
    const offset = drawRaw ? runs.length : 0;
    runs.forEach((r, i) => {
      const visible = r.visible !== false;
      const mainIdx = 1 + offset + i;
      if (u.series[mainIdx] && u.series[mainIdx].show !== visible) {
        u.setSeries(mainIdx, { show: visible });
      }
      if (drawRaw) {
        const rawIdx = 1 + i;
        if (u.series[rawIdx] && u.series[rawIdx].show !== visible) {
          u.setSeries(rawIdx, { show: visible });
        }
      }
    });
  }, [runs, config.smoothing.type, config.showRaw]);

  // Cross-plot hover highlight: thicken the hovered run, dim the rest.
  // NOTE: uPlot wraps `series.stroke` as a function on init and calls it on
  // every paint (cacheStrokeFill). We MUST keep it callable — replacing it
  // with a plain string crashes the draw loop and blanks out all lines.
  useEffect(() => {
    const u = plotRef.current;
    if (!u) return;
    const drawRaw = config.smoothing.type !== 'none' && config.showRaw !== false;
    const offset = drawRaw ? runs.length : 0;

    runs.forEach((r, i) => {
      const mainIdx = 1 + offset + i;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const series = u.series[mainIdx] as any;
      if (!series) return;
      if (hoveredRunId == null) {
        series.stroke = () => r.color;
        series.width = STROKE_NORMAL;
      } else if (r.runId === hoveredRunId) {
        series.stroke = () => r.color;
        series.width = STROKE_HIGHLIGHT;
      } else {
        const dim = withAlpha(r.color, STROKE_DIM_ALPHA);
        series.stroke = () => dim;
        series.width = STROKE_NORMAL;
      }
      // Force the path to be rebuilt so the new width is baked in.
      series._paths = null;
    });
    u.redraw(false);
  }, [hoveredRunId, runs, config.smoothing.type, config.showRaw]);

  // Clear the global hover state when the cursor leaves the chart entirely.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onLeave = () => {
      if (closestRef.current !== -1) {
        closestRef.current = -1;
        setHoveredRun(null);
      }
    };
    host.addEventListener('mouseleave', onLeave);
    return () => host.removeEventListener('mouseleave', onLeave);
  }, [setHoveredRun]);

  // Right-click on the chart → open the sample for the closest run at the
  // cursor's step. Step is read from the closest run's nearest sampled x
  // (so it always lands on a real recorded step value).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onContextMenu = (e: MouseEvent) => {
      const u = plotRef.current;
      const closest = closestRef.current;
      if (!u || closest < 0) return;
      const run = runsRef.current[closest];
      if (!run) return;

      const cursorX = u.posToVal(u.cursor.left ?? 0, 'x');
      let step = run.points[0]?.x ?? 0;
      let bestD = Infinity;
      for (const p of run.points) {
        const d = Math.abs(p.x - cursorX);
        if (d < bestD) { bestD = d; step = p.x; }
      }

      e.preventDefault();
      openSamplePeek({
        runId: run.runId,
        runLabel: run.label,
        runColor: run.color,
        step: Math.round(step),
        anchor: { x: e.clientX, y: e.clientY },
      });
    };
    host.addEventListener('contextmenu', onContextMenu);
    return () => host.removeEventListener('contextmenu', onContextMenu);
  }, [openSamplePeek]);

  return (
    <div
      ref={wrapRef}
      className={s.wrap}
      style={fill ? { height: '100%' } : { height }}
    >
      {runs.length === 0 ? (
        <div className={s.empty}>No visible runs</div>
      ) : (
        <>
          <div ref={hostRef} className={s.host} />
          {createPortal(<div ref={tipRef} className={s.tip} />, document.body)}
        </>
      )}
    </div>
  );
}
