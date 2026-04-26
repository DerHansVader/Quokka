import type { PanelConfig } from '@quokka/shared';
import { PanelCard } from './PanelCard';
import type { RunSeriesEntry } from './Panel';
import { useCollapsedGroups, groupName } from '../hooks/useCollapsedGroups';
import s from './PanelGrid.module.css';

interface Props {
  panels: PanelConfig[];
  runsForPanel: (panel: PanelConfig) => RunSeriesEntry[];
  editingIndex: number | null;
  onOpenSettings: (index: number) => void;
  groupStateId?: string;
  emptyMessage?: string;
}

export function PanelGrid({
  panels, runsForPanel, editingIndex, onOpenSettings, groupStateId, emptyMessage,
}: Props) {
  const { collapsed, toggle } = useCollapsedGroups(groupStateId);

  if (panels.length === 0) {
    return <div className={s.empty}>{emptyMessage ?? 'No panels yet.'}</div>;
  }

  const groups = new Map<string, { index: number; panel: PanelConfig; runs: RunSeriesEntry[] }[]>();
  panels.forEach((panel, index) => {
    const runs = runsForPanel(panel);
    if (runs.length === 0) return;
    const g = groupName(panel.keys[0] || 'other');
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push({ index, panel, runs });
  });

  const names = [...groups.keys()].sort();
  if (names.length === 0) {
    return <div className={s.empty}>{emptyMessage ?? 'No data for the current selection.'}</div>;
  }

  return (
    <div className={s.groups}>
      {names.map((name) => {
        const items = groups.get(name)!;
        const isCollapsed = !!collapsed[name];
        return (
          <section key={name}>
            <button onClick={() => toggle(name)} className={s.groupHead}>
              <span className={[s.chev, isCollapsed ? '' : s.chevOpen].join(' ')}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </span>
              <span className={s.groupName}>{name}</span>
              <span className={s.groupCount}>{items.length}</span>
            </button>

            {!isCollapsed && (
              <div className={s.grid}>
                {items.map(({ index, panel, runs }) => (
                  <PanelCard
                    key={index}
                    config={panel}
                    runs={runs}
                    isEditing={editingIndex === index}
                    onOpenSettings={() => onOpenSettings(index)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
