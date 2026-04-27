import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import type { PanelConfig, MetricPoint } from '@quokka/shared';
import { api } from '../lib/api';
import { useRunStream } from '../hooks/useRunStream';
import { usePersistedPanels } from '../hooks/usePersistedPanels';
import { StatusBadge } from '../components/StatusBadge';
import { PanelGrid } from '../components/PanelGrid';
import { Canvas } from '../components/Canvas';
import { SampleViewer } from '../components/SampleViewer';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { ViewModeToggle } from '../components/ViewModeToggle';
import type { RunSeriesEntry } from '../components/Panel';
import { resolveXY, isBuiltinXAxis } from '../lib/xaxis';
import s from './RunViewerPage.module.css';
import p from './shared.module.css';

interface Run {
  id: string;
  name: string;
  displayName: string | null;
  status: string;
  startedAt: string;
  notes: string | null;
  config: Record<string, any>;
  project: { slug: string; team: { slug: string } };
  createdBy: { name: string };
}

export function RunViewerPage() {
  const { runId } = useParams<{ runId: string }>();
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [tab, setTab] = useState<'charts' | 'samples'>('charts');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useRunStream(runId);

  const { data: run } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api.get<Run>('/runs/' + runId),
  });

  const { data: keys } = useQuery({
    queryKey: ['keys', runId],
    queryFn: () => api.get<string[]>('/runs/' + runId + '/keys'),
  });

  const {
    mode, setMode, panels, updatePanel,
    addCanvasPanel, removeCanvasPanel, removeCanvasPanels,
    groups, addGroup, removeGroup,
    viewport, setViewport,
  } = usePersistedPanels('run', runId, keys);

  const { data: seriesData } = useQuery({
    queryKey: ['series', runId, keys],
    queryFn: () =>
      api.get<Record<string, MetricPoint[]>>(
        '/runs/' + runId + '/series?keys=' + (keys ?? []).join(','),
      ),
    enabled: !!keys?.length,
    refetchInterval: run?.status === 'running' ? 5000 : false,
  });

  const renameMut = useMutation({
    mutationFn: (displayName: string) => api.patch('/runs/' + runId, { displayName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['run', runId] });
      setEditingName(false);
    },
  });

  const notesMut = useMutation({
    mutationFn: (notes: string) => api.patch('/runs/' + runId, { notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['run', runId] }),
  });

  if (!run) return (
    <div className={s.root}>
      <div className={s.loading}><div className={s.spinner} /></div>
    </div>
  );

  const teamSlug = run.project.team.slug;
  const projectSlug = run.project.slug;

  const runsForPanel = (panel: PanelConfig): RunSeriesEntry[] => {
    if (!seriesData) return [];
    const key = panel.keys[0];
    const raw = seriesData[key];
    if (!raw?.length) return [];
    const xAxis = panel.xAxis || 'step';
    const xMap = !isBuiltinXAxis(xAxis) && seriesData[xAxis]
      ? new Map(seriesData[xAxis].map((p: MetricPoint) => [p.step, p.value]))
      : undefined;
    const points = resolveXY(raw, xAxis, xMap);
    if (!points.length) return [];
    return [{
      runId: run.id,
      label: run.displayName || run.name,
      color: '#a78bfa',
      points,
    }];
  };

  const startDate = new Date(run.startedAt);
  const startTime = startDate.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const startHour = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div
        className={[s.root, editingIndex !== null && tab === 'charts' ? s.rootShifted : ''].join(' ')}
      >
        <div className={p.breadcrumb}>
          <Link to={'/' + teamSlug}>{teamSlug}</Link>
          <span className={p.breadcrumbSep}>/</span>
          <Link to={'/' + teamSlug + '/' + projectSlug}>{projectSlug}</Link>
          <span className={p.breadcrumbSep}>/</span>
          <span className={p.breadcrumbCurrent}>{run.displayName || run.name}</span>
        </div>

        <div className={s.titleRow}>
          <div className={s.titleCol}>
            {editingName ? (
              <form
                onSubmit={(e) => { e.preventDefault(); renameMut.mutate(newName); }}
                className={s.editRow}
              >
                <div className={s.editInput}>
                  <Input value={newName}
                    onChange={(e) => setNewName(e.target.value)} autoFocus />
                </div>
                <Button size="sm" type="submit" loading={renameMut.isPending}>Save</Button>
              </form>
            ) : (
              <h1
                className={s.title}
                onClick={() => { setEditingName(true); setNewName(run.displayName || run.name); }}
              >
                {run.displayName || run.name}
              </h1>
            )}
            <p className={s.meta}>
              by {run.createdBy.name} · {startTime} at {startHour}
            </p>
          </div>
          <StatusBadge status={run.status} />
        </div>

        <textarea
          className={s.notes}
          placeholder="Add notes about this run…"
          rows={2}
          defaultValue={run.notes || ''}
          onBlur={(e) => {
            if (e.target.value !== (run.notes || '')) notesMut.mutate(e.target.value);
          }}
        />

        <div className={s.tabs}>
          {(['charts', 'samples'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[s.tab, tab === t ? s.tabActive : ''].join(' ')}
            >
              {t === 'charts' ? 'Charts' : 'Samples'}
            </button>
          ))}
        </div>

        {tab === 'charts' && (
          <>
            <div className={s.viewToolbar}>
              <ViewModeToggle value={mode} onChange={setMode} />
            </div>
            {mode === 'canvas' ? (
              <Canvas
                panels={panels}
                runsForPanel={runsForPanel}
                availableKeys={keys ?? []}
                viewport={viewport}
                onViewportChange={setViewport}
                onPanelChange={updatePanel}
                onPanelAdd={addCanvasPanel}
                onPanelRemove={removeCanvasPanel}
                onPanelsRemove={removeCanvasPanels}
                editingIndex={editingIndex}
                onOpenSettings={(i) => setEditingIndex(i === editingIndex ? null : i)}
                groups={groups}
                onAddGroup={addGroup}
                onRemoveGroup={removeGroup}
              />
            ) : (
              <PanelGrid
                panels={panels}
                runsForPanel={runsForPanel}
                editingIndex={editingIndex}
                onOpenSettings={(i) => setEditingIndex(i === editingIndex ? null : i)}
                groupStateId={'run-' + runId}
              />
            )}
          </>
        )}
        {tab === 'samples' && <SampleViewer runId={runId!} />}
      </div>

      <SettingsDrawer
        config={editingIndex !== null && tab === 'charts' ? panels[editingIndex] ?? null : null}
        onChange={(c) => editingIndex !== null && updatePanel(editingIndex, c)}
        onClose={() => setEditingIndex(null)}
        availableKeys={keys || []}
      />
    </>
  );
}
