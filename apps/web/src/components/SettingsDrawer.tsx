import type { PanelConfig } from '@quokka/shared';
import { PanelSettings } from './PanelSettings';
import s from './SettingsDrawer.module.css';

interface Props {
  config: PanelConfig | null;
  onChange: (config: PanelConfig) => void;
  onClose: () => void;
  availableKeys: string[];
}

export const SETTINGS_DRAWER_WIDTH = 320;

export function SettingsDrawer({ config, onChange, onClose, availableKeys }: Props) {
  const open = !!config;
  return (
    <aside
      className={[s.drawer, open ? s.open : ''].join(' ')}
      aria-hidden={!open}
    >
      {config && (
        <PanelSettings
          config={config}
          onChange={onChange}
          onClose={onClose}
          availableKeys={availableKeys}
        />
      )}
    </aside>
  );
}
