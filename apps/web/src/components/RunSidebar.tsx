import { Link } from 'react-router-dom';
import type { RunDisplayMap } from '../hooks/useRunDisplay';
import { useHoverStore } from '../stores/hover';
import s from './RunSidebar.module.css';

interface Run {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

interface Props {
  teamSlug: string;
  projectSlug: string;
  runs: Run[];
  display: RunDisplayMap;
  onUpdate: (runId: string, patch: { visible?: boolean; color?: string }) => void;
  onToggleAll: (visible: boolean) => void;
}

export function RunSidebar({ teamSlug, projectSlug, runs, display, onUpdate, onToggleAll }: Props) {
  const allVisible = runs.length > 0 && runs.every((r) => display[r.id]?.visible !== false);
  const setHovered = useHoverStore((s) => s.setRunId);

  return (
    <div className={s.root}>
      <div className={s.head}>
        <span className={s.count}>{runs.length} {runs.length === 1 ? 'run' : 'runs'}</span>
        {runs.length > 0 && (
          <button onClick={() => onToggleAll(!allVisible)} className={s.toggleAll}>
            {allVisible ? 'Hide all' : 'Show all'}
          </button>
        )}
      </div>
      <div className={s.divider} />

      <div className={s.list}>
        {runs.length === 0 && <p className={s.empty}>No runs yet</p>}
        {runs.map((run) => {
          const d = display[run.id] ?? { visible: true, color: '#a78bfa' };
          const statusCls =
            run.status === 'running' ? s.statusRunning :
            run.status === 'crashed' ? s.statusCrashed : '';
          return (
            <div
              key={run.id}
              className={s.item}
              onMouseEnter={() => d.visible && setHovered(run.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <button
                onClick={() => onUpdate(run.id, { visible: !d.visible })}
                className={s.visBtn}
                title={d.visible ? 'Hide' : 'Show'}
                aria-pressed={d.visible}
                style={{ color: d.visible ? d.color : 'var(--text-muted)' }}
              >
                <EyeIcon open={d.visible} />
              </button>

              <label className={s.colorBtn} title="Change color">
                <span className={s.colorSwatch} style={{ background: d.color }} />
                <input
                  type="color"
                  value={d.color}
                  onChange={(e) => onUpdate(run.id, { color: e.target.value })}
                  className={s.colorInput}
                />
              </label>

              <span className={[s.statusDot, statusCls].join(' ')} />

              <Link
                to={`/${teamSlug}/${projectSlug}/runs/${run.id}`}
                className={s.name}
                title={run.name}
              >
                {run.name}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
