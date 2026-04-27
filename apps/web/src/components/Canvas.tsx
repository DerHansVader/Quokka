import { useEffect, useMemo, useRef, useState } from 'react';
import type { PanelConfig } from '@quokka/shared';
import { Panel, type RunSeriesEntry } from './Panel';
import s from './Canvas.module.css';

const CELL = 40;
const MIN_W = 4;
const MIN_H = 3;
const MAX_W = 24;
const MAX_H = 14;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;

interface Viewport { x: number; y: number; zoom: number }

interface Props {
  panels: PanelConfig[];
  runsForPanel: (panel: PanelConfig) => RunSeriesEntry[];
  availableKeys: string[];
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  onPanelChange: (index: number, c: PanelConfig) => void;
  onPanelAdd: (key: string) => void;
  onPanelRemove: (id: string) => void;
  onOpenSettings: (index: number) => void;
  editingIndex: number | null;
}

type DragState =
  | { kind: 'move'; id: string; sx: number; sy: number; x0: number; y0: number; x: number; y: number }
  | { kind: 'resize'; id: string; sx: number; sy: number; w0: number; h0: number; w: number; h: number }
  | { kind: 'pan'; sx: number; sy: number; vx0: number; vy0: number };

export function Canvas({
  panels, runsForPanel, availableKeys, viewport, onViewportChange,
  onPanelChange, onPanelAdd, onPanelRemove, onOpenSettings, editingIndex,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [vp, setVp] = useState<Viewport>(viewport);
  useEffect(() => setVp(viewport), [viewport]);

  const usedKeys = useMemo(
    () => new Set(panels.flatMap((p) => p.keys)),
    [panels],
  );

  // ── interactions ─────────────────────────────────────────────
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - drag.sx) / vp.zoom;
      const dy = (e.clientY - drag.sy) / vp.zoom;
      if (drag.kind === 'move') {
        setDrag({ ...drag, x: drag.x0 + dx, y: drag.y0 + dy });
      } else if (drag.kind === 'resize') {
        setDrag({
          ...drag,
          w: clamp(drag.w0 + dx / CELL, MIN_W, MAX_W),
          h: clamp(drag.h0 + dy / CELL, MIN_H, MAX_H),
        });
      } else {
        const next = {
          ...vp,
          x: drag.vx0 + (e.clientX - drag.sx),
          y: drag.vy0 + (e.clientY - drag.sy),
        };
        setVp(next);
      }
    };
    const onUp = () => {
      if (drag.kind === 'move') {
        const i = panels.findIndex((p) => p.id === drag.id);
        if (i >= 0) {
          onPanelChange(i, {
            ...panels[i],
            x: snap(drag.x / CELL),
            y: snap(drag.y / CELL),
          });
        }
      } else if (drag.kind === 'resize') {
        const i = panels.findIndex((p) => p.id === drag.id);
        if (i >= 0) {
          onPanelChange(i, {
            ...panels[i],
            w: snap(drag.w),
            h: snap(drag.h),
          });
        }
      } else {
        onViewportChange(vp);
      }
      setDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, vp, panels, onPanelChange, onViewportChange]);

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const k = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const nz = clamp(vp.zoom * k, ZOOM_MIN, ZOOM_MAX);
    // Anchor zoom at the cursor: world point under cursor stays put.
    const nx = mx - (mx - vp.x) * (nz / vp.zoom);
    const ny = my - (my - vp.y) * (nz / vp.zoom);
    const next = { x: nx, y: ny, zoom: nz };
    setVp(next);
    onViewportChange(next);
  };

  const onBgDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains(s.bg)) return;
    setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, vx0: vp.x, vy0: vp.y });
  };

  const startMove = (e: React.MouseEvent, p: PanelConfig) => {
    e.stopPropagation();
    if (!p.id) return;
    setDrag({
      kind: 'move',
      id: p.id,
      sx: e.clientX,
      sy: e.clientY,
      x0: (p.x ?? 0) * CELL,
      y0: (p.y ?? 0) * CELL,
      x: (p.x ?? 0) * CELL,
      y: (p.y ?? 0) * CELL,
    });
  };

  const startResize = (e: React.MouseEvent, p: PanelConfig) => {
    e.stopPropagation();
    if (!p.id) return;
    setDrag({
      kind: 'resize',
      id: p.id,
      sx: e.clientX,
      sy: e.clientY,
      w0: p.w ?? MIN_W,
      h0: p.h ?? MIN_H,
      w: p.w ?? MIN_W,
      h: p.h ?? MIN_H,
    });
  };

  // ── render ───────────────────────────────────────────────────
  const renderedPanels = panels.map((p) => {
    if (drag && 'id' in drag && drag.id === p.id) {
      if (drag.kind === 'move') return { ...p, x: drag.x / CELL, y: drag.y / CELL };
      if (drag.kind === 'resize') return { ...p, w: drag.w, h: drag.h };
    }
    return p;
  });

  return (
    <div className={s.root} ref={rootRef} onWheel={onWheel}>
      <Toolbar
        availableKeys={availableKeys}
        usedKeys={usedKeys}
        onAdd={onPanelAdd}
      />

      <div
        className={s.viewport}
        onMouseDown={onBgDown}
        style={{ cursor: drag?.kind === 'pan' ? 'grabbing' : 'grab' }}
      >
        <div
          className={s.bg}
          style={{
            transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
            transformOrigin: '0 0',
            backgroundSize: `${CELL}px ${CELL}px`,
          }}
        />
        <div
          className={s.world}
          style={{
            transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {renderedPanels.map((p, i) => {
            const x = (p.x ?? 0) * CELL;
            const y = (p.y ?? 0) * CELL;
            const w = (p.w ?? MIN_W) * CELL;
            const h = (p.h ?? MIN_H) * CELL;
            const isEditing = editingIndex === i;
            const isDragging = drag && 'id' in drag && drag.id === p.id;
            const runs = runsForPanel(p);
            return (
              <div
                key={p.id ?? i}
                className={[
                  s.panel,
                  isEditing ? s.panelEditing : '',
                  isDragging ? s.panelDragging : '',
                ].join(' ')}
                style={{ left: x, top: y, width: w, height: h }}
              >
                <div className={s.header} onMouseDown={(e) => startMove(e, p)}>
                  <span className={s.title}>{p.keys.join(', ')}</span>
                  <div className={s.actions}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenSettings(i); }}
                      className={[s.iconBtn, isEditing ? s.iconBtnActive : ''].join(' ')}
                      title="Configure"
                    >
                      <Cog />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); p.id && onPanelRemove(p.id); }}
                      className={s.iconBtn}
                      title="Remove"
                    >
                      <Cross />
                    </button>
                  </div>
                </div>
                <div className={s.chart}>
                  {runs.length > 0
                    ? <Panel config={p} runs={runs} />
                    : <div className={s.noData}>No data</div>}
                </div>
                <div
                  className={s.resize}
                  onMouseDown={(e) => startResize(e, p)}
                  title="Resize"
                />
              </div>
            );
          })}
        </div>
      </div>

      <ZoomBadge
        zoom={vp.zoom}
        onReset={() => {
          const next = { x: 0, y: 0, zoom: 1 };
          setVp(next);
          onViewportChange(next);
        }}
      />
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const snap = (n: number) => Math.max(0, Math.round(n));

function Toolbar({
  availableKeys, usedKeys, onAdd,
}: { availableKeys: string[]; usedKeys: Set<string>; onAdd: (k: string) => void }) {
  const [filter, setFilter] = useState('');
  const keys = availableKeys.filter((k) =>
    !filter || k.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div className={s.toolbar}>
      <input
        className={s.search}
        placeholder="Add metric…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className={s.chips}>
        {keys.length === 0 && <span className={s.empty}>No metrics match</span>}
        {keys.map((k) => (
          <button
            key={k}
            className={[s.chip, usedKeys.has(k) ? s.chipUsed : ''].join(' ')}
            onClick={() => onAdd(k)}
            title={usedKeys.has(k) ? 'Already on canvas — click to add another' : 'Add to canvas'}
          >
            <span className={s.plus}>+</span>{k}
          </button>
        ))}
      </div>
    </div>
  );
}

function ZoomBadge({ zoom, onReset }: { zoom: number; onReset: () => void }) {
  return (
    <button className={s.zoomBadge} onClick={onReset} title="Reset view">
      {Math.round(zoom * 100)}%
    </button>
  );
}

const Cog = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2.5" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const Cross = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
