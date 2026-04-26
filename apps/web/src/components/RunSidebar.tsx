import { Link } from 'react-router-dom';
import type { RunDisplayMap } from '../hooks/useRunDisplay';
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
            <div key={run.id} className={s.item}>
              <button
                onClick={() => onUpdate(run.id, { visible: !d.visible })}
                className={s.visBtn}
                title={d.visible ? 'Hide' : 'Show'}
              >
                <span
                  className={s.vis}
                  style={{
                    background: d.visible ? d.color : 'transparent',
                    boxShadow: d.visible ? 'none' : 'inset 0 0 0 1.5px rgba(255,255,255,0.18)',
                  }}
                />
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
