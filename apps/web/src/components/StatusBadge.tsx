import s from './StatusBadge.module.css';

const known = new Set(['running', 'finished', 'crashed']);

export function StatusBadge({ status }: { status: string }) {
  const key = known.has(status) ? status : 'finished';
  return (
    <span className={[s.badge, s[key]].join(' ')}>
      <span className={s.dot} />
      {status}
    </span>
  );
}
