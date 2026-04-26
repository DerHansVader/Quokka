import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { PanelConfig, MetricPoint } from '@quokka/shared';
import { api } from '../lib/api';
import { PanelGrid } from '../components/PanelGrid';
import { RunSidebar } from '../components/RunSidebar';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { useRunDisplay } from '../hooks/useRunDisplay';
import { usePersistedPanels } from '../hooks/usePersistedPanels';
import type { RunSeriesEntry } from '../components/Panel';
import { resolveXY, isBuiltinXAxis } from '../lib/xaxis';
import s from './RunsPage.module.css';

interface Project { id: string; slug: string; name: string; }
interface Run {
  id: string;
  name: string;
  displayName: string | null;
  status: string;
  startedAt: string;
  createdAt: string;
}

export function RunsPage() {
  const { teamSlug, projectSlug } = useParams<{ teamSlug: string; projectSlug: string }>();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', teamSlug, projectSlug],
    queryFn: () => api.get<Project>('/teams/' + teamSlug + '/projects/' + projectSlug),
  });

  const { data: runs } = useQuery({
    queryKey: ['runs', project?.id],
    queryFn: () => api.get<Run[]>('/projects/' + project!.id + '/runs'),
    enabled: !!project,
    refetchInterval: 5000,
  });

  const runIds = useMemo(() => runs?.map((r) => r.id) || [], [runs]);
  const { display, update, toggleAll } = useRunDisplay(project?.id, runIds);

  const visibleRunIds = useMemo(
    () => runIds.filter((id) => display[id]?.visible !== false),
    [runIds, display],
  );

  const { data: allKeys } = useQuery({
    queryKey: ['project-keys', project?.id],
    queryFn: () => api.get<string[]>('/projects/' + project!.id + '/keys'),
    enabled: !!project,
    refetchInterval: 5000,
  });

  const { panels, updatePanel } = usePersistedPanels('project', project?.id, allKeys);

  const { data: compareData } = useQuery({
    queryKey: ['project-series', project?.id, visibleRunIds, allKeys],
    queryFn: () =>
      api.get<Record<string, Record<string, MetricPoint[]>>>(
        '/compare?runs=' + visibleRunIds.join(',') + '&keys=' + (allKeys ?? []).join(','),
      ),
    enabled: !!allKeys?.length && visibleRunIds.length > 0,
    refetchInterval: 5000,
  });

  const runsForPanel = (panel: PanelConfig): RunSeriesEntry[] => {
    if (!runs || !compareData) return [];
    const key = panel.keys[0];
    const byRun = compareData[key];
    if (!byRun) return [];
    const xAxis = panel.xAxis || 'step';
    const xSeriesByRun = !isBuiltinXAxis(xAxis) ? compareData[xAxis] : undefined;

    return visibleRunIds
      .map((id) => {
        const run = runs.find((r) => r.id === id);
        if (!run) return null;
        const raw = byRun[id];
        if (!raw || raw.length === 0) return null;
        const xMap = xSeriesByRun
          ? new Map(xSeriesByRun[id]?.map((p: MetricPoint) => [p.step, p.value]))
          : undefined;
        const points = resolveXY(raw, xAxis, xMap);
        if (points.length === 0) return null;
        return {
          runId: id,
          label: run.displayName || run.name,
          color: display[id]?.color || '#a78bfa',
          points,
        };
      })
      .filter((x): x is RunSeriesEntry => x !== null);
  };

  const sortedRuns = useMemo(
    () => (runs || []).slice().sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)),
    [runs],
  );

  const sidebarRuns = sortedRuns.map((r) => ({
    id: r.id,
    name: r.displayName || r.name,
    status: r.status,
    createdAt: r.startedAt,
  }));

  const runningCount = runs?.filter((r) => r.status === 'running').length ?? 0;

  return (
    <div className={s.root}>
      <aside className={s.sidebar}>
        <div className={s.sidebarHead}>
          <Link to={'/' + teamSlug} className={s.backLink}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {teamSlug}
          </Link>
          <div className={s.projectName}>{project?.name || projectSlug}</div>
          {runningCount > 0 && (
            <p className={s.runningHint}>
              {runningCount} {runningCount === 1 ? 'run' : 'runs'} active
            </p>
          )}
        </div>
        <RunSidebar
          teamSlug={teamSlug!}
          projectSlug={projectSlug!}
          runs={sidebarRuns}
          display={display}
          onUpdate={update}
          onToggleAll={toggleAll}
        />
      </aside>

      <section className={[s.main, editingIndex !== null ? s.mainShifted : ''].join(' ')}>
        {!runs?.length ? (
          <EmptyState
            title="No runs yet"
            hint="Push data from your training script using the SDK"
            iconPath="M22 12h-4l-3 9L9 3l-3 9H2"
          />
        ) : visibleRunIds.length === 0 ? (
          <EmptyState
            title="All runs hidden"
            hint="Toggle runs in the sidebar to compare them"
            iconPath="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"
          />
        ) : (
          <PanelGrid
            panels={panels}
            runsForPanel={runsForPanel}
            editingIndex={editingIndex}
            onOpenSettings={(i) => setEditingIndex(i === editingIndex ? null : i)}
            groupStateId={teamSlug + '/' + projectSlug}
            emptyMessage="No metrics for the visible runs"
          />
        )}
      </section>

      <SettingsDrawer
        config={editingIndex !== null ? panels[editingIndex] ?? null : null}
        onChange={(c) => editingIndex !== null && updatePanel(editingIndex, c)}
        onClose={() => setEditingIndex(null)}
        availableKeys={allKeys || []}
      />
    </div>
  );
}

function EmptyState({ title, hint, iconPath }: { title: string; hint: string; iconPath: string }) {
  return (
    <div className={s.emptyState}>
      <div className={s.emptyIcon}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round">
          <path d={iconPath} />
        </svg>
      </div>
      <p className={s.emptyTitle}>{title}</p>
      <p className={s.emptyHint}>{hint}</p>
    </div>
  );
}
