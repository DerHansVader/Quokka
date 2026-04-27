import { useEffect, useState } from 'react';
import type { PanelConfig, SmoothingType, ScaleType } from '@quokka/shared';
import { X_AXIS_LABELS, isBuiltinXAxis } from '../lib/xaxis';
import { isWindowType } from '../lib/smoothing';
import s from './PanelSettings.module.css';

const SMOOTHING_OPTIONS: { value: SmoothingType; label: string }[] = [
  { value: 'none',     label: 'None' },
  { value: 'ema',      label: 'EMA' },
  { value: 'dema',     label: 'DEMA — low lag' },
  { value: 'gaussian', label: 'Gaussian' },
  { value: 'sma',      label: 'Moving average' },
  { value: 'median',   label: 'Median' },
  { value: 'savgol',   label: 'Savitzky–Golay' },
];

interface Props {
  config: PanelConfig;
  onChange: (config: PanelConfig) => void;
  onClose: () => void;
  availableKeys: string[];
}

export function PanelSettings({ config, onChange, onClose, availableKeys }: Props) {
  const update = (patch: Partial<PanelConfig>) => onChange({ ...config, ...patch });
  const xAxis = config.xAxis || 'step';
  const metricKeys = availableKeys.filter((k) => !isBuiltinXAxis(k));

  return (
    <div className={s.root}>
      <div className={s.head}>
        <div className={s.headText}>
          <div className={s.kicker}>Configure panel</div>
          <div className={s.titleText}>{config.keys.join(', ')}</div>
        </div>
        <button onClick={onClose} className={s.close} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className={s.divider} />

      <div className={s.body}>
        <Field label="X axis">
          <select value={xAxis} onChange={(e) => update({ xAxis: e.target.value })} className={s.select}>
            <optgroup label="Built-in">
              {Object.entries(X_AXIS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </optgroup>
            {metricKeys.length > 0 && (
              <optgroup label="Metric">
                {metricKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </optgroup>
            )}
          </select>
        </Field>

        <Field label="Smoothing">
          <select
            value={config.smoothing.type}
            onChange={(e) => update({ smoothing: { ...config.smoothing, type: e.target.value as SmoothingType } })}
            className={s.select}
          >
            {SMOOTHING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {config.smoothing.type !== 'none' && (
            <>
              {isWindowType(config.smoothing.type) ? (
                <Slider
                  label="Window"
                  value={config.smoothing.window ?? 10}
                  min={0} max={100} step={1}
                  format={(v) => v === 0 ? 'off' : `${v} (±${Math.floor(v / 2)})`}
                  onChange={(v) => update({ smoothing: { ...config.smoothing, window: v } })}
                />
              ) : (
                <Slider
                  label="Strength"
                  value={config.smoothing.strength}
                  min={0} max={0.99} step={0.01}
                  format={(v) => v.toFixed(2)}
                  onChange={(v) => update({ smoothing: { ...config.smoothing, strength: v } })}
                />
              )}
              <Toggle
                label="Show raw data"
                checked={config.showRaw !== false}
                onChange={(v) => update({ showRaw: v })}
              />
            </>
          )}
        </Field>

        <Field label="Outlier exclusion">
          <div className={s.inline}>
            <input
              type="range" min={0} max={10} step={0.1}
              value={config.outlier.pct}
              onChange={(e) => update({ outlier: { pct: +e.target.value } })}
              className={s.slider}
            />
            <span className={s.inlineValue}>
              {config.outlier.pct > 0 ? config.outlier.pct.toFixed(1) + '%' : 'off'}
            </span>
          </div>
        </Field>

        <Field label="Scale">
          <div className={s.pair}>
            <div>
              <div className={s.pairLabel}>X</div>
              <select
                value={config.xScale}
                onChange={(e) => update({ xScale: e.target.value as ScaleType })}
                className={s.select}
              >
                <option value="linear">Linear</option>
                <option value="log">Log</option>
              </select>
            </div>
            <div>
              <div className={s.pairLabel}>Y</div>
              <select
                value={config.yScale}
                onChange={(e) => update({ yScale: e.target.value as ScaleType })}
                className={s.select}
              >
                <option value="linear">Linear</option>
                <option value="log">Log</option>
              </select>
            </div>
          </div>
        </Field>

        <Field label="Y range">
          <RangeInputs value={config.yDomain} onChange={(v) => update({ yDomain: v })} />
        </Field>

        <Field label="X range">
          <RangeInputs value={config.xDomain} onChange={(v) => update({ xDomain: v })} />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={s.field}>
      <div className={s.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, format,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className={s.sliderRow}>
      <div className={s.sliderHead}>
        <span>{label}</span>
        <span className={s.sliderValue}>{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className={s.slider}
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={s.toggle}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[s.toggleTrack, checked ? s.toggleTrackOn : ''].join(' ')}
      >
        <span className={[s.toggleKnob, checked ? s.toggleKnobOn : ''].join(' ')} />
      </button>
    </label>
  );
}

function RangeInputs({
  value, onChange,
}: { value?: [number, number]; onChange: (v: [number, number] | undefined) => void }) {
  // Track raw text locally so partial input (e.g. only "min" filled in)
  // doesn't get wiped by the parent clearing the value.
  const [lo, setLo] = useState(value ? String(value[0]) : '');
  const [hi, setHi] = useState(value ? String(value[1]) : '');

  useEffect(() => {
    setLo(value ? String(value[0]) : '');
    setHi(value ? String(value[1]) : '');
  }, [value]);

  const commit = (loStr: string, hiStr: string) => {
    const a = parseFloat(loStr);
    const b = parseFloat(hiStr);
    if (Number.isFinite(a) && Number.isFinite(b)) onChange([a, b]);
    else if (loStr === '' && hiStr === '') onChange(undefined);
  };

  return (
    <div className={s.pair}>
      <input type="number" placeholder="min" value={lo}
        onChange={(e) => { setLo(e.target.value); commit(e.target.value, hi); }}
        className={s.rangeInput} />
      <input type="number" placeholder="max" value={hi}
        onChange={(e) => { setHi(e.target.value); commit(lo, e.target.value); }}
        className={s.rangeInput} />
    </div>
  );
}
