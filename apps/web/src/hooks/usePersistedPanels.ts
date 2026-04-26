import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PanelConfig } from '@quokka/shared';
import { api } from '../lib/api';

interface View {
  id: string;
  layout: PanelConfig[];
}

type Scope = 'project' | 'run';

const SAVE_DEBOUNCE_MS = 400;

function defaultPanel(key: string): PanelConfig {
  return {
    keys: [key],
    smoothing: { type: 'none', strength: 0 },
    outlier: { pct: 0 },
    xScale: 'linear',
    yScale: 'linear',
  };
}

/**
 * Loads (or creates) the default view for a project / run, merges in default
 * panels for any keys not yet covered, and persists edits back debounced.
 */
export function usePersistedPanels(
  scope: Scope,
  scopeId: string | undefined,
  allKeys: string[] | undefined,
) {
  const qc = useQueryClient();
  const key = ['view-default', scope, scopeId] as const;

  const { data: view } = useQuery({
    queryKey: key,
    queryFn: () =>
      api.get<View>(`/views/default?scope=${scope}&scopeId=${scopeId}`),
    enabled: !!scopeId,
  });

  const panels = useMemo<PanelConfig[]>(() => {
    if (!view) return [];
    const stored = view.layout ?? [];
    if (!allKeys?.length) return stored;
    const covered = new Set(stored.flatMap((p) => p.keys));
    const fresh = allKeys.filter((k) => !covered.has(k)).map(defaultPanel);
    return fresh.length ? [...stored, ...fresh] : stored;
  }, [view, allKeys]);

  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const save = (next: PanelConfig[]) => {
    if (!view) return;
    qc.setQueryData(key, { ...view, layout: next });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      api.patch(`/views/${view.id}`, { layout: next }).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  };

  const updatePanel = (i: number, c: PanelConfig) => {
    save(panels.map((p, idx) => (idx === i ? c : p)));
  };

  return { panels, updatePanel, isLoading: !view };
}
