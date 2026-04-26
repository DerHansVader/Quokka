import { useEffect, useState } from 'react';

const COLOR_PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#8b5cf6',
  '#eab308', '#10b981', '#6366f1', '#d946ef', '#84cc16',
];

export interface RunDisplay {
  visible: boolean;
  color: string;
}

export type RunDisplayMap = Record<string, RunDisplay>;

export function assignColor(index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

/** Per-project run visibility + color, persisted in localStorage. */
export function useRunDisplay(projectId: string | undefined, runIds: string[]) {
  const storageKey = projectId ? `wt:run-display:${projectId}` : null;

  const [display, setDisplay] = useState<RunDisplayMap>(() => {
    if (!storageKey) return {};
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!storageKey || runIds.length === 0) return;
    setDisplay((prev) => {
      const next = { ...prev };
      let changed = false;
      runIds.forEach((id, i) => {
        if (!next[id]) {
          next[id] = { visible: true, color: assignColor(i) };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [runIds.join(','), storageKey]);

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(display));
  }, [display, storageKey]);

  const update = (runId: string, patch: Partial<RunDisplay>) => {
    setDisplay((prev) => ({ ...prev, [runId]: { ...prev[runId], ...patch } }));
  };

  const toggleAll = (visible: boolean) => {
    setDisplay((prev) => {
      const next = { ...prev };
      runIds.forEach((id) => {
        next[id] = { ...next[id], visible };
      });
      return next;
    });
  };

  return { display, update, toggleAll };
}
