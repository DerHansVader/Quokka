import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { PanelConfig } from '@quokka/shared';
import { smooth, excludeOutliers, isWindowType } from '../lib/smoothing';
import { alignRunValues, plotValues } from './panelData';
import s from './Panel.module.css';

const SYNC_KEY = 'wt-panels';
const DEFAULT_HEIGHT = 240;

export interface RunSeriesEntry {
  runId: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
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

  // (re)build the plot when data or config changes
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
        }))
      : [];

    const mainSeries = runs.map((r) => ({
      label: r.label,
      stroke: r.color,
      width: 1.75,
      spanGaps: true,
      points: { show: false },
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
        x: { distr: config.xScale === 'log' ? 3 : 1, time: isTime },
        y: {
          distr: config.yScale === 'log' ? 3 : 1,
          ...(config.yDomain ? { range: config.yDomain } : {}),
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
            const x = idx != null && idx >= 0 ? u.data[0][idx] : null;
            if (x == null || !Number.isFinite(x)) {
              tip.style.display = 'none';
              return;
            }
            const rows = runs
              .map((r, i) => {
                const y = u.data[smoothedStart + i]?.[idx!];
                return (
                  `<div class="${s.tipRow}">` +
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

            const left = u.cursor.left ?? 0;
            const top = u.cursor.top ?? 0;
            const rootW = u.root.getBoundingClientRect().width;
            const tipW = tip.offsetWidth;
            const off = 12;
            const x1 = left + off + tipW > rootW ? left - tipW - off : left + off;
            tip.style.left = Math.max(0, x1) + 'px';
            tip.style.top = Math.max(0, top + off) + 'px';
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
          <div ref={tipRef} className={s.tip} />
        </>
      )}
    </div>
  );
}
