import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { MetricPoint } from '@quokka/shared';
import { api } from '../lib/api';
import s from './MultiRunSamples.module.css';

interface Sample {
  id: string;
  step: number;
  key: string;
  imagePath: string | null;
  gt: string | null;
  pred: string | null;
}

interface RunInput {
  id: string;
  label: string;
  color: string;
}

export function MultiRunSamples({ runs }: { runs: RunInput[] }) {
  // ── 1. Sample keys (one query per run, fanned out) ───────────
  const keysQueries = useQueries({
    queries: runs.map((r) => ({
      queryKey: ['sample-keys', r.id],
      queryFn: () => api.get<string[]>('/runs/' + r.id + '/sample-keys'),
    })),
  });

  const allKeys = useMemo(() => {
    const set = new Set<string>();
    keysQueries.forEach((q) => q.data?.forEach((k) => set.add(k)));
    return Array.from(set).sort();
  }, [keysQueries]);

  const [activeKey, setActiveKey] = useState<string | undefined>();
  const key = activeKey || allKeys[0];

  // ── 2. Samples per run for the active key ────────────────────
  const sampleQueries = useQueries({
    queries: runs.map((r) => ({
      queryKey: ['samples', r.id, key],
      queryFn: () => api.get<Sample[]>('/runs/' + r.id + '/samples?key=' + key),
      enabled: !!key,
    })),
  });

  // ── 3. Loss per run (for header chips) ──────────────────────
  const runIds = runs.map((r) => r.id).join(',');
  const { data: lossData } = useQuery({
    queryKey: ['multi-loss', runIds],
    queryFn: () =>
      api.get<Record<string, Record<string, MetricPoint[]>>>(
        '/compare?runs=' + runIds + '&keys=loss',
      ),
    enabled: runs.length > 0,
  });

  // ── 4. Unified step axis across all runs ────────────────────
  const steps = useMemo(() => {
    const set = new Set<number>();
    sampleQueries.forEach((q) => q.data?.forEach((s) => set.add(s.step)));
    return Array.from(set).sort((a, b) => a - b);
  }, [sampleQueries]);

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = steps[stepIdx];

  useEffect(() => {
    if (steps.length && stepIdx >= steps.length) setStepIdx(steps.length - 1);
  }, [steps, stepIdx]);

  // Reset to last (newest) step whenever the key changes.
  useEffect(() => {
    setStepIdx(Math.max(0, steps.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // ── 5. Drag-to-scroll the column row ────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let down = false;
    let sx = 0;
    let scroll0 = 0;
    const onDown = (e: MouseEvent) => {
      // Middle click anywhere, or left click on empty whitespace between columns.
      const t = e.target as HTMLElement;
      const inCol = t.closest('[data-col]');
      if (e.button === 1 || (e.button === 0 && !inCol)) {
        down = true;
        sx = e.clientX;
        scroll0 = el.scrollLeft;
        el.classList.add(s.dragging);
        e.preventDefault();
      }
    };
    const onMove = (e: MouseEvent) => {
      if (!down) return;
      el.scrollLeft = scroll0 - (e.clientX - sx);
    };
    const onUp = () => {
      down = false;
      el.classList.remove(s.dragging);
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (keysQueries.some((q) => q.isLoading)) return <Empty text="Loading samples…" />;
  if (!allKeys.length) return <Empty text="No samples logged yet" />;

  const stepLabel = currentStep ?? '—';

  return (
    <div className={s.root}>
      <div className={s.controls}>
        <select
          value={key}
          onChange={(e) => setActiveKey(e.target.value)}
          className={s.select}
        >
          {allKeys.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>

        {steps.length > 0 && (
          <div className={s.stepper}>
            <span className={s.stepLabel}>step {stepLabel}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, steps.length - 1)}
              value={stepIdx}
              onChange={(e) => setStepIdx(+e.target.value)}
              className={s.slider}
            />
            <span className={s.stepIdx}>{stepIdx + 1}/{steps.length}</span>
          </div>
        )}
      </div>

      <div className={s.scroll} ref={scrollRef}>
        <div className={s.row}>
          {runs.map((run, i) => {
            const samples = sampleQueries[i].data ?? [];
            const sample = samples.find((s) => s.step === currentStep) ?? null;
            const loss = pickLossAt(lossData?.loss?.[run.id], currentStep);
            return (
              <div key={run.id} data-col className={s.col}>
                <div className={s.colHead}>
                  <span
                    className={s.dot}
                    style={{ background: run.color }}
                  />
                  <span className={s.runName} title={run.label}>{run.label}</span>
                  <span className={s.lossChip}>
                    {loss != null ? formatLoss(loss) : '—'}
                  </span>
                </div>

                {sample ? (
                  <div className={s.colBody}>
                    <SamplePanel label="Ground truth" content={sample.gt} accent={false} />
                    <SamplePanel label="Prediction" content={sample.pred} accent={true} />
                  </div>
                ) : (
                  <div className={[s.colBody, s.colBodyEmpty].join(' ')}>
                    <span className={s.dash}>—</span>
                    <span className={s.emptyHint}>no sample at this step</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function pickLossAt(points: MetricPoint[] | undefined, step: number | undefined) {
  if (!points || step == null) return undefined;
  const exact = points.find((p) => p.step === step);
  if (exact) return exact.value;
  // Fall back to the most recent loss point at or before the current step.
  let best: number | undefined;
  for (const p of points) if (p.step <= step) best = p.value;
  return best;
}

function formatLoss(v: number) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0)) return v.toExponential(2);
  return v.toFixed(4);
}

function SamplePanel({
  label, content, accent,
}: { label: string; content: string | null; accent: boolean }) {
  return (
    <div className={s.panel}>
      <div className={s.panelHead}>
        <span className={[s.panelDot, accent ? s.panelDotAccent : ''].join(' ')} />
        <span className={s.panelLabel}>{label}</span>
      </div>
      <div className={s.panelBody}>
        {content ? <pre>{content}</pre> : <p className={s.panelEmpty}>—</p>}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className={s.empty}>{text}</div>;
}
