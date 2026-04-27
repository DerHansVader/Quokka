import { useEffect, useMemo, useRef, useState } from 'react';
import type { GroupConfig, PanelConfig } from '@quokka/shared';
import { Panel, type RunSeriesEntry } from './Panel';
import s from './Canvas.module.css';

const CELL = 40;
const MIN_W = 4;
const MIN_H = 3;
const MAX_W = 32;
const MAX_H = 18;
const DEFAULT_W = 8;
const DEFAULT_H = 5;
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
  onPanelAdd: (key: string, at: { x: number; y: number }) => void;
  onPanelRemove: (id: string) => void;
  onPanelsRemove: (ids: string[]) => void;
  onOpenSettings: (index: number) => void;
  editingIndex: number | null;
  groups: GroupConfig[];
  onAddGroup: (panelIds: string[], name: string) => void;
  onRemoveGroup: (id: string) => void;
}

type Drag =
  | { kind: 'move'; id: string; sx: number; sy: number; x0: number; y0: number; x: number; y: number }
  | { kind: 'resize'; id: string; sx: number; sy: number; w0: number; h0: number; w: number; h: number }
  | { kind: 'pan'; sx: number; sy: number; vx0: number; vy0: number }
  | { kind: 'marquee'; sx: number; sy: number; ex: number; ey: number };

interface CtxMenu {
  x: number; y: number;
  kind: 'bg' | 'panel' | 'multi';
  panelId?: string;
  worldX?: number;  // for bg menu: where to place new panels
  worldY?: number;
  /** Selected panel ids when kind === 'multi'. */
  selectedIds?: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const snap = (n: number) => Math.round(n);

export function Canvas({
  panels, runsForPanel, availableKeys, viewport, onViewportChange,
  onPanelChange, onPanelAdd, onPanelRemove, onPanelsRemove,
  onOpenSettings, editingIndex,
  groups, onAddGroup, onRemoveGroup,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [vp, setVp] = useState<Viewport>(viewport);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ctx, setCtx] = useState<CtxMenu | null>(null);

  useEffect(() => setVp(viewport), [viewport]);

  // ── initial centering ────────────────────────────────────────
  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current || !rootRef.current) return;
    if (viewport.x !== 0 || viewport.y !== 0 || viewport.zoom !== 1) {
      centeredRef.current = true;
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    const next = { x: rect.width / 2, y: rect.height / 2, zoom: 1 };
    setVp(next);
    onViewportChange(next);
    centeredRef.current = true;
  }, [viewport, onViewportChange]);

  // ── helpers ──────────────────────────────────────────────────
  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - vp.x) / vp.zoom,
    y: (sy - vp.y) / vp.zoom,
  });
  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = rootRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const usedKeys = useMemo(
    () => new Set(panels.flatMap((p) => p.keys)),
    [panels],
  );

  // ── interactions during drag ─────────────────────────────────
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      if (drag.kind === 'move') {
        const dx = (e.clientX - drag.sx) / vp.zoom;
        const dy = (e.clientY - drag.sy) / vp.zoom;
        setDrag({ ...drag, x: drag.x0 + dx, y: drag.y0 + dy });
      } else if (drag.kind === 'resize') {
        const dx = (e.clientX - drag.sx) / vp.zoom;
        const dy = (e.clientY - drag.sy) / vp.zoom;
        setDrag({
          ...drag,
          w: clamp(drag.w0 + dx / CELL, MIN_W, MAX_W),
          h: clamp(drag.h0 + dy / CELL, MIN_H, MAX_H),
        });
      } else if (drag.kind === 'pan') {
        setVp({
          ...vp,
          x: drag.vx0 + (e.clientX - drag.sx),
          y: drag.vy0 + (e.clientY - drag.sy),
        });
      } else {
        const lp = localPoint(e);
        setDrag({ ...drag, ex: lp.x, ey: lp.y });
      }
    };
    const onUp = () => {
      if (drag.kind === 'move') {
        const i = panels.findIndex((p) => p.id === drag.id);
        if (i >= 0) onPanelChange(i, {
          ...panels[i], x: snap(drag.x / CELL), y: snap(drag.y / CELL),
        });
      } else if (drag.kind === 'resize') {
        const i = panels.findIndex((p) => p.id === drag.id);
        if (i >= 0) onPanelChange(i, {
          ...panels[i], w: snap(drag.w), h: snap(drag.h),
        });
      } else if (drag.kind === 'pan') {
        onViewportChange(vp);
      } else {
        // marquee: select panels overlapping the rect (in world coords)
        const rx0 = Math.min(drag.sx, drag.ex);
        const ry0 = Math.min(drag.sy, drag.ey);
        const rx1 = Math.max(drag.sx, drag.ex);
        const ry1 = Math.max(drag.sy, drag.ey);
        if (rx1 - rx0 > 3 || ry1 - ry0 > 3) {
          const w0 = screenToWorld(rx0, ry0);
          const w1 = screenToWorld(rx1, ry1);
          const next = new Set<string>();
          for (const p of panels) {
            if (!p.id) continue;
            const px = (p.x ?? 0) * CELL, py = (p.y ?? 0) * CELL;
            const pw = (p.w ?? MIN_W) * CELL, ph = (p.h ?? MIN_H) * CELL;
            if (px < w1.x && px + pw > w0.x && py < w1.y && py + ph > w0.y) {
              next.add(p.id);
            }
          }
          setSelected(next);
        } else {
          setSelected(new Set());
        }
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

  // ── canvas event handlers ────────────────────────────────────
  // Native non-passive listener so we can preventDefault() the page-zoom gesture.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const lp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const k = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nz = clamp(vp.zoom * k, ZOOM_MIN, ZOOM_MAX);
      const nx = lp.x - (lp.x - vp.x) * (nz / vp.zoom);
      const ny = lp.y - (lp.y - vp.y) * (nz / vp.zoom);
      const next = { x: nx, y: ny, zoom: nz };
      setVp(next);
      onViewportChange(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [vp, onViewportChange]);

  // Middle-click — or Cmd/Ctrl + left-click — pans from anywhere.
  // Plain left-click on empty bg starts marquee selection.
  const isPanGesture = (e: { button: number; metaKey: boolean; ctrlKey: boolean }) =>
    e.button === 1 || (e.button === 0 && (e.metaKey || e.ctrlKey));

  const onRootDown = (e: React.MouseEvent) => {
    if (isPanGesture(e)) {
      e.preventDefault();
      setCtx(null);
      setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, vx0: vp.x, vy0: vp.y });
    }
  };
  const onBgDown = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget && !t.classList.contains(s.bg)) return;
    if (isPanGesture(e)) return;  // root will pan
    setCtx(null);
    if (e.button === 0) {
      const lp = localPoint(e);
      setDrag({ kind: 'marquee', sx: lp.x, sy: lp.y, ex: lp.x, ey: lp.y });
    }
  };

  const onBgContext = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget && !t.classList.contains(s.bg)) return;
    e.preventDefault();
    const lp = localPoint(e);
    const w = screenToWorld(lp.x, lp.y);
    setCtx({ x: lp.x, y: lp.y, kind: 'bg', worldX: w.x, worldY: w.y });
  };

  const startMove = (e: React.MouseEvent, p: PanelConfig) => {
    if (e.button !== 0 || !p.id) return;
    if (e.metaKey || e.ctrlKey) return;  // root will pan
    e.stopPropagation();
    setCtx(null);
    setDrag({
      kind: 'move', id: p.id,
      sx: e.clientX, sy: e.clientY,
      x0: (p.x ?? 0) * CELL, y0: (p.y ?? 0) * CELL,
      x: (p.x ?? 0) * CELL, y: (p.y ?? 0) * CELL,
    });
  };

  const startResize = (e: React.MouseEvent, p: PanelConfig) => {
    if (e.button !== 0 || !p.id) return;
    if (e.metaKey || e.ctrlKey) return;
    e.stopPropagation();
    setCtx(null);
    setDrag({
      kind: 'resize', id: p.id,
      sx: e.clientX, sy: e.clientY,
      w0: p.w ?? MIN_W, h0: p.h ?? MIN_H,
      w: p.w ?? MIN_W, h: p.h ?? MIN_H,
    });
  };

  const onPanelContext = (e: React.MouseEvent, p: PanelConfig) => {
    e.preventDefault();
    e.stopPropagation();
    const lp = localPoint(e);
    // Right-click on a member of a multi-selection → multi menu.
    // Right-click on a non-selected panel → switch selection to just that one.
    if (p.id && selected.has(p.id) && selected.size > 1) {
      setCtx({ x: lp.x, y: lp.y, kind: 'multi', selectedIds: [...selected] });
    } else {
      if (p.id) setSelected(new Set([p.id]));
      setCtx({ x: lp.x, y: lp.y, kind: 'panel', panelId: p.id });
    }
  };

  // ── viewport helpers ─────────────────────────────────────────
  const setViewport = (v: Viewport) => { setVp(v); onViewportChange(v); };

  const centerView = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    setViewport({ x: rect.width / 2, y: rect.height / 2, zoom: 1 });
  };

  const fitAll = () => {
    if (!panels.length) return centerView();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    let lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity;
    for (const p of panels) {
      const x = (p.x ?? 0) * CELL, y = (p.y ?? 0) * CELL;
      const w = (p.w ?? MIN_W) * CELL, h = (p.h ?? MIN_H) * CELL;
      lx = Math.min(lx, x); ly = Math.min(ly, y);
      hx = Math.max(hx, x + w); hy = Math.max(hy, y + h);
    }
    const PAD = 80;
    const zw = (rect.width  - PAD * 2) / (hx - lx);
    const zh = (rect.height - PAD * 2) / (hy - ly);
    const zoom = clamp(Math.min(zw, zh), ZOOM_MIN, ZOOM_MAX);
    const cx = (lx + hx) / 2;
    const cy = (ly + hy) / 2;
    setViewport({
      x: rect.width / 2 - cx * zoom,
      y: rect.height / 2 - cy * zoom,
      zoom,
    });
  };

  const focusPanel = (p: PanelConfig) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = ((p.x ?? 0) + (p.w ?? MIN_W) / 2) * CELL;
    const cy = ((p.y ?? 0) + (p.h ?? MIN_H) / 2) * CELL;
    setViewport({ x: rect.width / 2 - cx, y: rect.height / 2 - cy, zoom: 1 });
    if (p.id) setSelected(new Set([p.id]));
  };

  /** Bounding box of a set of panel ids in world (px) coords. Null if empty. */
  const bbox = (ids: string[]) => {
    const ps = panels.filter((p) => p.id && ids.includes(p.id));
    if (!ps.length) return null;
    let lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity;
    for (const p of ps) {
      const x = (p.x ?? 0) * CELL, y = (p.y ?? 0) * CELL;
      const w = (p.w ?? MIN_W) * CELL, h = (p.h ?? MIN_H) * CELL;
      lx = Math.min(lx, x); ly = Math.min(ly, y);
      hx = Math.max(hx, x + w); hy = Math.max(hy, y + h);
    }
    return { lx, ly, hx, hy };
  };

  const centerOnSelection = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const b = bbox([...selected]);
    if (!b) return;
    const cx = (b.lx + b.hx) / 2;
    const cy = (b.ly + b.hy) / 2;
    setViewport({ x: rect.width / 2 - cx, y: rect.height / 2 - cy, zoom: 1 });
  };

  const groupSelected = () => {
    const ids = [...selected];
    if (ids.length < 2) return;
    const name = window.prompt('Name this group', `Group ${groups.length + 1}`);
    if (name == null) return;
    onAddGroup(ids, name.trim() || `Group ${groups.length + 1}`);
  };

  const removeSelected = () => {
    onPanelsRemove([...selected]);
    setSelected(new Set());
  };

  const addAtCenter = (key: string) => {
    const rect = rootRef.current!.getBoundingClientRect();
    const w = screenToWorld(rect.width / 2, rect.height / 2);
    onPanelAdd(key, {
      x: snap(w.x / CELL - DEFAULT_W / 2),
      y: snap(w.y / CELL - DEFAULT_H / 2),
    });
  };
  const addAt = (key: string, world: { x: number; y: number }) => {
    onPanelAdd(key, {
      x: snap(world.x / CELL - DEFAULT_W / 2),
      y: snap(world.y / CELL - DEFAULT_H / 2),
    });
  };

  // ── render ───────────────────────────────────────────────────
  const renderedPanels = panels.map((p) => {
    if (drag && 'id' in drag && drag.id === p.id) {
      if (drag.kind === 'move')   return { ...p, x: drag.x / CELL, y: drag.y / CELL };
      if (drag.kind === 'resize') return { ...p, w: drag.w, h: drag.h };
    }
    return p;
  });

  // Snap-preview ghost while dragging or resizing one panel
  let ghost: { x: number; y: number; w: number; h: number } | null = null;
  if (drag?.kind === 'move') {
    const i = panels.findIndex((p) => p.id === drag.id);
    if (i >= 0) {
      const p = panels[i];
      ghost = {
        x: snap(drag.x / CELL),
        y: snap(drag.y / CELL),
        w: p.w ?? MIN_W, h: p.h ?? MIN_H,
      };
    }
  } else if (drag?.kind === 'resize') {
    const i = panels.findIndex((p) => p.id === drag.id);
    if (i >= 0) {
      const p = panels[i];
      ghost = {
        x: p.x ?? 0, y: p.y ?? 0,
        w: snap(drag.w), h: snap(drag.h),
      };
    }
  }

  return (
    <div
      ref={rootRef}
      className={[s.root, drag?.kind === 'pan' ? s.rootPanning : ''].join(' ')}
      onMouseDown={onRootDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Toolbar
        availableKeys={availableKeys}
        usedKeys={usedKeys}
        onAdd={addAtCenter}
      />

      <div
        className={s.viewport}
        onMouseDown={onBgDown}
        onContextMenu={onBgContext}
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
          {/* Group bounding rectangles render behind the panels. */}
          {groups.map((g) => {
            const b = bbox(g.panelIds);
            if (!b) return null;
            const PAD = 12;
            return (
              <div
                key={g.id}
                className={s.group}
                style={{
                  left: b.lx - PAD,
                  top: b.ly - PAD,
                  width: b.hx - b.lx + PAD * 2,
                  height: b.hy - b.ly + PAD * 2,
                }}
              >
                <div className={s.groupLabel}>
                  <span>{g.name}</span>
                  <button
                    className={s.groupClose}
                    onClick={() => onRemoveGroup(g.id)}
                    title="Ungroup"
                  >
                    <Cross />
                  </button>
                </div>
              </div>
            );
          })}

          {ghost && (
            <div
              className={s.ghost}
              style={{
                left: ghost.x * CELL,
                top: ghost.y * CELL,
                width: ghost.w * CELL,
                height: ghost.h * CELL,
              }}
            />
          )}

          {renderedPanels.map((p, i) => {
            const x = (p.x ?? 0) * CELL;
            const y = (p.y ?? 0) * CELL;
            const w = (p.w ?? MIN_W) * CELL;
            const h = (p.h ?? MIN_H) * CELL;
            const isEditing = editingIndex === i;
            const isDragging = drag && 'id' in drag && drag.id === p.id;
            const isSelected = p.id ? selected.has(p.id) : false;
            const runs = runsForPanel(p);
            return (
              <div
                key={p.id ?? i}
                className={[
                  s.panel,
                  isEditing ? s.panelEditing : '',
                  isSelected ? s.panelSelected : '',
                  isDragging ? s.panelDragging : '',
                ].join(' ')}
                style={{ left: x, top: y, width: w, height: h }}
                onContextMenu={(e) => onPanelContext(e, p)}
              >
                <div className={s.header} onMouseDown={(e) => startMove(e, p)}>
                  <span className={s.handle} />
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
                    ? <Panel config={p} runs={runs} fill />
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

        {drag?.kind === 'marquee' && (
          <div
            className={s.marquee}
            style={{
              left: Math.min(drag.sx, drag.ex),
              top: Math.min(drag.sy, drag.ey),
              width: Math.abs(drag.ex - drag.sx),
              height: Math.abs(drag.ey - drag.sy),
            }}
          />
        )}
      </div>

      <ZoomBadge zoom={vp.zoom} onReset={centerView} />

      {ctx && (
        <ContextMenu
          x={ctx.x} y={ctx.y}
          onClose={() => setCtx(null)}
          items={
            ctx.kind === 'bg'
              ? bgItems({
                  availableKeys, usedKeys,
                  onAdd: (k) => addAt(k, { x: ctx.worldX!, y: ctx.worldY! }),
                  onCenter: centerView,
                  onFitAll: fitAll,
                  onFind: focusPanel,
                  panels,
                })
              : ctx.kind === 'multi'
              ? multiItems({
                  count: ctx.selectedIds!.length,
                  onGroup: groupSelected,
                  onCenter: centerOnSelection,
                  onClear: () => setSelected(new Set()),
                  onRemove: removeSelected,
                })
              : panelItems({
                  panels, panelId: ctx.panelId!,
                  onConfigure: (i) => onOpenSettings(i),
                  onRemove: (id) => onPanelRemove(id),
                })
          }
        />
      )}
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────
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
            title="Add to canvas"
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
    <button className={s.zoomBadge} onClick={onReset} title="Center view">
      {Math.round(zoom * 100)}%
    </button>
  );
}

// ── Context menu ─────────────────────────────────────────────
type Item =
  | { kind: 'item'; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }
  | { kind: 'submenu'; label: string; items: Item[] }
  | { kind: 'sep' };

function ContextMenu({
  x, y, items, onClose,
}: { x: number; y: number; items: Item[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className={s.menu}
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Items items={items} onAct={onClose} />
    </div>
  );
}

function Items({ items, onAct }: { items: Item[]; onAct: () => void }) {
  return (
    <>
      {items.map((it, i) => {
        if (it.kind === 'sep') return <div key={i} className={s.menuSep} />;
        if (it.kind === 'submenu') {
          return (
            <div key={i} className={s.menuItem + ' ' + s.menuSubmenu}>
              <span>{it.label}</span>
              <span className={s.menuChev}>›</span>
              <div className={s.submenuPanel}>
                <Items items={it.items} onAct={onAct} />
              </div>
            </div>
          );
        }
        return (
          <button
            key={i}
            className={[s.menuItem, it.danger ? s.menuDanger : ''].join(' ')}
            onClick={() => { it.onClick(); onAct(); }}
            disabled={it.disabled}
          >
            {it.label}
          </button>
        );
      })}
    </>
  );
}

function bgItems({
  availableKeys, usedKeys, onAdd, onCenter, onFitAll, onFind, panels,
}: {
  availableKeys: string[]; usedKeys: Set<string>;
  onAdd: (k: string) => void;
  onCenter: () => void;
  onFitAll: () => void;
  onFind: (p: PanelConfig) => void;
  panels: PanelConfig[];
}): Item[] {
  return [
    {
      kind: 'submenu', label: 'Add metric',
      items: availableKeys.length
        ? availableKeys.map((k): Item => ({
            kind: 'item',
            label: usedKeys.has(k) ? k + '  •' : k,
            onClick: () => onAdd(k),
          }))
        : [{ kind: 'item', label: 'No metrics yet', onClick: () => {}, disabled: true }],
    },
    { kind: 'sep' },
    { kind: 'item', label: 'Center view',         onClick: onCenter },
    { kind: 'item', label: 'Fit all to viewport', onClick: onFitAll, disabled: panels.length === 0 },
    {
      kind: 'submenu', label: 'Find element',
      items: panels.length
        ? panels.map((p): Item => ({
            kind: 'item',
            label: p.keys.join(', '),
            onClick: () => onFind(p),
          }))
        : [{ kind: 'item', label: 'No panels yet', onClick: () => {}, disabled: true }],
    },
  ];
}

function panelItems({
  panels, panelId, onConfigure, onRemove,
}: {
  panels: PanelConfig[]; panelId: string;
  onConfigure: (i: number) => void;
  onRemove: (id: string) => void;
}): Item[] {
  const i = panels.findIndex((p) => p.id === panelId);
  return [
    { kind: 'item', label: 'Configure',  onClick: () => onConfigure(i), disabled: i < 0 },
    { kind: 'sep' },
    { kind: 'item', label: 'Remove', danger: true, onClick: () => onRemove(panelId) },
  ];
}

function multiItems({
  count, onGroup, onCenter, onClear, onRemove,
}: {
  count: number;
  onGroup: () => void;
  onCenter: () => void;
  onClear: () => void;
  onRemove: () => void;
}): Item[] {
  return [
    { kind: 'item', label: `${count} panels selected`, onClick: () => {}, disabled: true },
    { kind: 'sep' },
    { kind: 'item', label: 'Group together…',     onClick: onGroup },
    { kind: 'item', label: 'Center on selection', onClick: onCenter },
    { kind: 'item', label: 'Clear selection',     onClick: onClear },
    { kind: 'sep' },
    { kind: 'item', label: `Remove ${count} panels`, danger: true, onClick: onRemove },
  ];
}

// ── icons ─────────────────────────────────────────────────────
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
