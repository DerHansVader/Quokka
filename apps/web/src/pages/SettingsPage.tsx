import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Page } from '../components/Page';
import s from './SettingsPage.module.css';
import p from './shared.module.css';

interface ApiKeyInfo {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
}

const keyIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

export function SettingsPage() {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<ApiKeyInfo[]>('/auth/api-keys'),
  });

  const createMut = useMutation({
    mutationFn: () => api.post<{ token: string }>('/auth/api-keys', { label }),
    onSuccess: (data) => {
      setNewToken(data.token);
      setLabel('');
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => api.delete('/auth/api-keys/' + id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const passwordMut = useMutation({
    mutationFn: () => api.post('/auth/password', { currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage('Password updated.');
    },
    onError: (err: any) => setPasswordMessage(err.message || 'Could not update password.'),
  });

  return (
    <Page>
      <div className={s.col}>
        <div className={p.pageHead}>
          <h1 className={p.h1}>Settings</h1>
          <p className={p.subtitle}>Manage your account and API keys</p>
        </div>

        <section className={s.section}>
          <div className={s.sectionHead}>
            <div>
              <h2 className={s.sectionTitle}>Password</h2>
              <p className={s.sectionHint}>Change the password for your account</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPasswordMessage('');
              passwordMut.mutate();
            }}
            className={s.createForm}
          >
            <div className={s.createField}>
              <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className={s.createField}>
              <Input
                label="New password"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button
              type="submit"
              loading={passwordMut.isPending}
              disabled={currentPassword.length === 0 || newPassword.length < 8}
            >
              Update password
            </Button>
          </form>
          {passwordMessage && <p className={s.formMessage}>{passwordMessage}</p>}
        </section>

        <section className={s.section}>
          <div className={s.sectionHead}>
            <div>
              <h2 className={s.sectionTitle}>API keys</h2>
              <p className={s.sectionHint}>Use these to authenticate the Python SDK</p>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className={s.createForm}>
            <div className={s.createField}>
              <Input label="Label" placeholder="training-server-1"
                value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <Button type="submit" loading={createMut.isPending} disabled={!label.trim()}>
              Create key
            </Button>
          </form>

          {newToken && (
            <div className={s.newToken}>
              <div className={s.newTokenRow}>
                <div className={s.newTokenBody}>
                  <p className={s.newTokenHint}>Copy your new key — it will not be shown again.</p>
                  <code className={s.newTokenCode}>{newToken}</code>
                </div>
                <button onClick={() => setNewToken(null)} className={s.dismiss} aria-label="Dismiss">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <button className={s.copy} onClick={() => navigator.clipboard.writeText(newToken)}>
                Copy to clipboard
              </button>
            </div>
          )}

          <div className={s.keyList}>
            {isLoading ? (
              [1, 2].map((i) => <div key={i} className={s.skeleton} />)
            ) : apiKeys?.length ? (
              apiKeys.map((key) => (
                <div key={key.id} className={s.keyRow}>
                  <div className={s.keyLeft}>
                    <div className={s.keyIcon}>{keyIcon}</div>
                    <div>
                      <div className={s.keyLabel}>{key.label}</div>
                      <div className={s.keyPrefix}>{key.prefix}…</div>
                    </div>
                  </div>
                  <div className={s.keyRight}>
                    <span className={s.keyDate}>
                      {new Date(key.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                    <button onClick={() => revokeMut.mutate(key.id)} className={s.revoke}>
                      Revoke
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className={s.empty}>No API keys yet</p>
            )}
          </div>
        </section>
      </div>
    </Page>
  );
}
