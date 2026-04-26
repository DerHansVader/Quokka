import { QuokkaMark } from './QuokkaMark';
import s from './AuthShell.module.css';

interface Props {
  title: string;
  subtitle?: string;
  error?: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, error, children }: Props) {
  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.head}>
          <div className={s.logo}>
            <QuokkaMark size={56} />
          </div>
          <h1 className={s.title}>{title}</h1>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>

        {error && (
          <div className={s.error}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
