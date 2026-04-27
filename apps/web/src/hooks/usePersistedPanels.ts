import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PanelConfig, ViewLayout, ViewMode } from '@quokka/shared';
import { api } from '../lib/api';

interface View {
  id: string;
  layout: any;
}

type Scope = 'project' | 'run';

const SAVE_DEBOUNCE_MS = 400;

const DEFAULT_W = 8;
const DEFAULT_H = 5;

const defaultPanel = (key: string): PanelConfig => ({
  keys: [key],
  smoothing: { type: 'none', strength: 0 },
  outlier: { pct: 0 },
  xScale: 'linear',
  yScale: 'linear',
});

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

/** Backward compat: old `View.layout` was just `PanelConfig[]`. */
function normalize(raw: any): ViewLayout {
  if (Array.isArray(raw)) {
    return {
      mode: 'grid',
      grid: raw,
      canvas: { panels: [], viewport: { x: 0, y: 0, zoom: 1 } },
    };
  }
  return {
    mode: raw?.mode === 'canvas' ? 'canvas' : 'grid',
    grid: Array.isArray(raw?.grid) ? raw.grid : [],
    canvas: {
      panels: Array.isArray(raw?.canvas?.panels) ? raw.canvas.panels : [],
      viewport: raw?.canvas?.viewport ?? { x: 0, y: 0, zoom: 1 },
    },
  };
}

/** Find the first non-overlapping spot for a new panel, scanning row-by-row. */
function nextSpot(panels: PanelConfig[], w: number, h: number) {
  if (!panels.length) return { x: 0, y: 0 };
  // Greedy: stack to the right of the last panel; wrap to a new row at width 24.
  const cols = 24;
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x + w <= cols; x++) {
      const overlaps = panels.some((p) => {
        const px = p.x ?? 0, py = p.y ?? 0;
        const pw = p.w ?? DEFAULT_W, ph = p.h ?? DEFAULT_H;
        return x < px + pw && x + w > px && y < py + ph && y + h > py;
      });
      if (!overlaps) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

export function usePersistedPanels(
  scope: Scope,
  scopeId: string | undefined,
  allKeys: string[] | undefined,
) {
  const qc = useQueryClient();
  const cacheKey = ['view-default', scope, scopeId] as const;

  const { data: view } = useQuery({
    queryKey: cacheKey,
    queryFn: () =>
      api.get<View>(`/views/default?scope=${scope}&scopeId=${scopeId}`),
    enabled: !!scopeId,
  });

  const layout = useMemo<ViewLayout>(() => normalize(view?.layout), [view]);

  /** Auto-merge default panels for any uncovered metric (grid mode only). */
  const gridPanels = useMemo<PanelConfig[]>(() => {
    if (!allKeys?.length) return layout.grid;
    const covered = new Set(layout.grid.flatMap((p) => p.keys));
    const fresh = allKeys.filter((k) => !covered.has(k)).map(defaultPanel);
    return fresh.length ? [...layout.grid, ...fresh] : layout.grid;
  }, [layout.grid, allKeys]);

  const panels = layout.mode === 'canvas' ? layout.canvas.panels : gridPanels;

  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const persist = (next: ViewLayout) => {
    if (!view) return;
    qc.setQueryData(cacheKey, { ...view, layout: next });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      api.patch(`/views/${view.id}`, { layout: next }).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  };

  const setMode = (mode: ViewMode) => persist({ ...layout, mode });

  const updatePanel = (i: number, c: PanelConfig) => {
    if (layout.mode === 'canvas') {
      const next = layout.canvas.panels.map((p, idx) => (idx === i ? c : p));
      persist({ ...layout, canvas: { ...layout.canvas, panels: next } });
    } else {
      const next = gridPanels.map((p, idx) => (idx === i ? c : p));
      persist({ ...layout, grid: next });
    }
  };

  const addCanvasPanel = (key: string) => {
    const w = DEFAULT_W, h = DEFAULT_H;
    const { x, y } = nextSpot(layout.canvas.panels, w, h);
    const next: PanelConfig = { ...defaultPanel(key), id: newId(), x, y, w, h };
    persist({
      ...layout,
      canvas: { ...layout.canvas, panels: [...layout.canvas.panels, next] },
    });
  };

  const removeCanvasPanel = (id: string) => {
    persist({
      ...layout,
      canvas: {
        ...layout.canvas,
        panels: layout.canvas.panels.filter((p) => p.id !== id),
      },
    });
  };

  const setViewport = (v: { x: number; y: number; zoom: number }) => {
    persist({ ...layout, canvas: { ...layout.canvas, viewport: v } });
  };

  return {
    mode: layout.mode,
    setMode,
    panels,
    updatePanel,
    addCanvasPanel,
    removeCanvasPanel,
    viewport: layout.canvas.viewport,
    setViewport,
    isLoading: !view,
  };
}
