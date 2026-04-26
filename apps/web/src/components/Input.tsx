import { InputHTMLAttributes, forwardRef } from 'react';
import s from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...rest }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined);
    return (
      <div className={s.field}>
        {label && <label htmlFor={inputId} className={s.label}>{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={[s.input, error ? s.hasError : '', className].join(' ')}
          {...rest}
        />
        {error && <p className={s.error}>{error}</p>}
        {hint && !error && <p className={s.hint}>{hint}</p>}
      </div>
    );
  },
);
