import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import s from './EmojiPicker.module.css';

const Picker = lazy(() => import('emoji-picker-react'));

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function EmojiPicker({ value, onChange, disabled, ariaLabel = 'Pick an icon' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={s.trigger}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {value || <span className={s.placeholder}>＋</span>}
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            className={s.popover}
            style={{ top: pos.top, left: pos.left }}
            role="dialog"
          >
            <Suspense fallback={<div className={s.loading}>Loading…</div>}>
              <Picker
                theme={'dark' as any}
                emojiStyle={'native' as any}
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
                width={320}
                height={400}
                onEmojiClick={(d) => {
                  onChange(d.emoji);
                  setOpen(false);
                }}
              />
            </Suspense>
            {value && (
              <button
                type="button"
                className={s.clear}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear icon
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
