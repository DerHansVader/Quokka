import type { ViewMode } from '@quokka/shared';
import s from './ViewModeToggle.module.css';

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div className={s.root} role="tablist" aria-label="View mode">
      <Button mode="grid" current={value} onChange={onChange}>
        <GridIcon />
        Grid
      </Button>
      <Button mode="canvas" current={value} onChange={onChange}>
        <CanvasIcon />
        Canvas
      </Button>
    </div>
  );
}

function Button({
  mode, current, onChange, children,
}: {
  mode: ViewMode;
  current: ViewMode;
  onChange: (m: ViewMode) => void;
  children: React.ReactNode;
}) {
  const active = current === mode;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => onChange(mode)}
      className={[s.btn, active ? s.btnActive : ''].join(' ')}
    >
      {children}
    </button>
  );
}

const GridIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const CanvasIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 8h5v5H8z" />
    <path d="M15 14h3v3" />
  </svg>
);
