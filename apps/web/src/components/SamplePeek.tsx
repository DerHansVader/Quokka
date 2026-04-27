import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSamplePeekStore } from '../stores/samplePeek';
import s from './SamplePeek.module.css';

interface Sample {
  id: string;
  step: number;
  key: string;
  imagePath: string | null;
  gt: string | null;
  pred: string | null;
}

const POPOVER_W = 520;
const POPOVER_H_MAX = 480;

export function SamplePeek() {
  const peek = useSamplePeekStore((s) => s.peek);
  const close = useSamplePeekStore((s) => s.close);

  useEffect(() => {
    if (!peek) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peek, close]);

  if (!peek) return null;

  return createPortal(
    <div className={s.backdrop} onMouseDown={close}>
      <div
        className={s.popover}
        style={position(peek.anchor)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Body peek={peek} onClose={close} />
      </div>
    </div>,
    document.body,
  );
}

function position(a: { x: number; y: number }): React.CSSProperties {
  const off = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = a.x + off;
  if (left + POPOVER_W > vw - 8) left = a.x - POPOVER_W - off;
  if (left < 8) left = 8;
  let top = a.y + off;
  if (top + POPOVER_H_MAX > vh - 8) top = Math.max(8, vh - POPOVER_H_MAX - 8);
  return { left, top, width: POPOVER_W };
}

function Body({
  peek,
  onClose,
}: {
  peek: NonNullable<ReturnType<typeof useSamplePeekStore.getState>['peek']>;
  onClose: () => void;
}) {
  const { runId, runLabel, runColor, step } = peek;

  const { data: keys, isLoading: keysLoading } = useQuery({
    queryKey: ['sample-keys', runId],
    queryFn: () => api.get<string[]>('/runs/' + runId + '/sample-keys'),
  });

  const [activeKey, setActiveKey] = useState<string | undefined>();
  const key = activeKey || keys?.[0];

  const { data: samples, isLoading: samplesLoading } = useQuery({
    queryKey: ['samples', runId, key],
    queryFn: () => api.get<Sample[]>('/runs/' + runId + '/samples?key=' + key),
    enabled: !!key,
  });

  // Pick the sample closest to (but not after) the requested step. Falls back
  // to the nearest sample if none are at or before the step.
  const sample = useMemo<Sample | undefined>(() => {
    if (!samples?.length) return undefined;
    let best: Sample | undefined;
    let bestD = Infinity;
    for (const sm of samples) {
      const d = Math.abs(sm.step - step);
      if (d < bestD) { bestD = d; best = sm; }
    }
    return best;
  }, [samples, step]);

  return (
    <>
      <div className={s.head}>
        <span className={s.dot} style={{ background: runColor }} />
        <span className={s.runName} title={runLabel}>{runLabel}</span>
        <span className={s.stepBadge}>step {sample?.step ?? step}</span>
        <button className={s.close} onClick={onClose} aria-label="Close">×</button>
      </div>

      {keys && keys.length > 1 && (
        <div className={s.keys}>
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => setActiveKey(k)}
              className={[s.key, k === key ? s.keyActive : ''].join(' ')}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      <div className={s.body}>
        {keysLoading || samplesLoading ? (
          <Empty text="Loading…" />
        ) : !keys?.length ? (
          <Empty text="No samples logged for this run" />
        ) : !sample ? (
          <Empty text="No samples for this key yet" />
        ) : (
          <div className={s.grid}>
            <Pane label="Ground truth" content={sample.gt} />
            <Pane label="Prediction" content={sample.pred} accent />
          </div>
        )}
      </div>
    </>
  );
}

function Pane({ label, content, accent = false }: { label: string; content: string | null; accent?: boolean }) {
  return (
    <div className={s.pane}>
      <div className={s.paneHead}>
        <span className={[s.paneDot, accent ? s.paneDotAccent : ''].join(' ')} />
        <span className={s.paneLabel}>{label}</span>
      </div>
      <div className={s.paneBody}>
        {content ? <pre>{content}</pre> : <p className={s.paneEmpty}>—</p>}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className={s.empty}>{text}</div>;
}
