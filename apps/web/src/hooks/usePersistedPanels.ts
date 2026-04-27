import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GroupConfig, PanelConfig, ViewLayout, ViewMode,
} from '@quokka/shared';
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
      canvas: { panels: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } },
    };
  }
  const canvasPanels: PanelConfig[] = Array.isArray(raw?.canvas?.panels)
    ? raw.canvas.panels.map((p: PanelConfig) => (p.id ? p : { ...p, id: newId() }))
    : [];
  return {
    mode: raw?.mode === 'canvas' ? 'canvas' : 'grid',
    grid: Array.isArray(raw?.grid) ? raw.grid : [],
    canvas: {
      panels: canvasPanels,
      groups: Array.isArray(raw?.canvas?.groups) ? raw.canvas.groups : [],
      viewport: raw?.canvas?.viewport ?? { x: 0, y: 0, zoom: 1 },
    },
  };
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

  const addCanvasPanel = (key: string, at: { x: number; y: number }) => {
    const next: PanelConfig = {
      ...defaultPanel(key), id: newId(),
      x: at.x, y: at.y, w: DEFAULT_W, h: DEFAULT_H,
    };
    persist({
      ...layout,
      canvas: { ...layout.canvas, panels: [...layout.canvas.panels, next] },
    });
  };

  const removeCanvasPanels = (ids: string[]) => {
    const idSet = new Set(ids);
    persist({
      ...layout,
      canvas: {
        ...layout.canvas,
        panels: layout.canvas.panels.filter((p) => !p.id || !idSet.has(p.id)),
        // Drop the panels from any groups; remove now-empty groups too.
        groups: layout.canvas.groups
          .map((g) => ({ ...g, panelIds: g.panelIds.filter((id) => !idSet.has(id)) }))
          .filter((g) => g.panelIds.length > 0),
      },
    });
  };
  const removeCanvasPanel = (id: string) => removeCanvasPanels([id]);

  const addGroup = (panelIds: string[], name: string) => {
    if (panelIds.length < 2) return;
    const idSet = new Set(panelIds);
    const next: GroupConfig = { id: newId(), name, panelIds };
    persist({
      ...layout,
      canvas: {
        ...layout.canvas,
        // Panels can only live in one group at a time — strip them from others.
        groups: [
          ...layout.canvas.groups
            .map((g) => ({ ...g, panelIds: g.panelIds.filter((id) => !idSet.has(id)) }))
            .filter((g) => g.panelIds.length > 0),
          next,
        ],
      },
    });
  };

  const removeGroup = (id: string) => {
    persist({
      ...layout,
      canvas: {
        ...layout.canvas,
        groups: layout.canvas.groups.filter((g) => g.id !== id),
      },
    });
  };

  const renameGroup = (id: string, name: string) => {
    persist({
      ...layout,
      canvas: {
        ...layout.canvas,
        groups: layout.canvas.groups.map((g) => (g.id === id ? { ...g, name } : g)),
      },
    });
  };

  /** Translate every panel in a group by an integer cell delta. */
  const moveGroupPanels = (id: string, dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    const g = layout.canvas.groups.find((g) => g.id === id);
    if (!g) return;
    const idSet = new Set(g.panelIds);
    const next = layout.canvas.panels.map((p) =>
      p.id && idSet.has(p.id)
        ? { ...p, x: (p.x ?? 0) + dx, y: (p.y ?? 0) + dy }
        : p,
    );
    persist({ ...layout, canvas: { ...layout.canvas, panels: next } });
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
    removeCanvasPanels,
    groups: layout.canvas.groups,
    addGroup,
    removeGroup,
    renameGroup,
    moveGroupPanels,
    viewport: layout.canvas.viewport,
    setViewport,
    isLoading: !view,
  };
}
