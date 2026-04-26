import s from './Page.module.css';

export function Page({ children }: { children: React.ReactNode }) {
  return <div className={s.page}>{children}</div>;
}
