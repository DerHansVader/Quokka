import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import s from './SampleViewer.module.css';

interface Sample {
  id: string;
  step: number;
  key: string;
  imagePath: string | null;
  gt: string | null;
  pred: string | null;
}

export function SampleViewer({ runId }: { runId: string }) {
  const { data: keys } = useQuery({
    queryKey: ['sample-keys', runId],
    queryFn: () => api.get<string[]>('/runs/' + runId + '/sample-keys'),
  });

  const [activeKey, setActiveKey] = useState<string | undefined>();
  const key = activeKey || keys?.[0];

  const { data: samples } = useQuery({
    queryKey: ['samples', runId, key],
    queryFn: () => api.get<Sample[]>('/runs/' + runId + '/samples?key=' + key),
    enabled: !!key,
  });

  const [idx, setIdx] = useState(0);
  const sample = samples?.[idx];

  if (!keys?.length) {
    return (
      <div className={s.empty}>
        <div className={s.emptyIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <p className={s.emptyText}>No samples logged yet</p>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.controls}>
        <select
          value={key}
          onChange={(e) => { setActiveKey(e.target.value); setIdx(0); }}
          className={s.select}
        >
          {keys.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>

        {samples && samples.length > 0 && (
          <div className={s.stepper}>
            <span className={s.stepLabel}>step {sample?.step ?? '--'}</span>
            <input
              type="range" min={0} max={Math.max(0, samples.length - 1)} value={idx}
              onChange={(e) => setIdx(+e.target.value)}
              className={s.slider}
            />
            <span className={s.stepIdx}>{idx + 1}/{samples.length}</span>
          </div>
        )}
      </div>

      {sample && (
        <div className={s.grid}>
          <SamplePanel label="Ground truth" content={sample.gt} accent={false} />
          <SamplePanel label="Prediction" content={sample.pred} accent={true} />
        </div>
      )}
    </div>
  );
}

function SamplePanel({ label, content, accent }: { label: string; content: string | null; accent: boolean }) {
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
