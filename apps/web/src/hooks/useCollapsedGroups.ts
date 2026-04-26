import { useEffect, useState } from 'react';

/** Collapsed state per panel group, persisted in localStorage. */
export function useCollapsedGroups(id: string | undefined) {
  const key = id ? `wt:panel-groups:${id}` : null;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (!key) return {};
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (key) localStorage.setItem(key, JSON.stringify(collapsed));
  }, [collapsed, key]);

  const toggle = (group: string) =>
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));

  return { collapsed, toggle };
}

/** Derive a group name from a metric key: "train/loss" -> "train". */
export function groupName(metricKey: string): string {
  const i = metricKey.indexOf('/');
  return i === -1 ? 'other' : metricKey.slice(0, i);
}
