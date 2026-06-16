import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Button } from './Button';
import s from './QuokkaSetupPrompt.module.css';

const DISMISS_KEY = 'qk_setup_prompt_dismissed';

interface Props {
  dismissible?: boolean;
  intro?: string;
}

function setupPrompt(baseUrl: string, apiKey: string) {
  return `Wire this project up with Quokka experiment tracking.

Quokka endpoint:
QK_BASE_URL=${baseUrl}

Quokka API key:
QK_API_KEY=${apiKey}

Please inspect the project first, then make the smallest clean change that:
1. Installs the Quokka Python SDK if needed: pip install quokka-tracker
2. Sets QK_BASE_URL and QK_API_KEY for local runs without committing secrets.
3. Initializes Quokka once near the training entrypoint.
4. Logs core scalars such as loss, eval loss, accuracy, learning rate, and step.
5. Calls quokka.finish() when training completes.
6. Keeps training working when Quokka is unavailable.

Use this minimal Python pattern:

import os
import quokka

if os.environ.get("QK_API_KEY"):
    quokka.login(os.environ["QK_API_KEY"])
    quokka.init(project="<project-name>", run="<run-name>", config={})

for step in range(num_steps):
    metrics = train_step()
    quokka.log(metrics, step=step)

quokka.finish()`;
}

function defaultBaseUrl() {
  return typeof window === 'undefined' ? 'https://quokka.example.com' : window.location.origin;
}

export function isNewUser(createdAt?: string) {
  if (!createdAt || localStorage.getItem(DISMISS_KEY)) return false;
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

export function QuokkaSetupPrompt({ dismissible = false, intro }: Props) {
  const { token } = useAuthStore();
  const [apiKey, setApiKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const baseUrl = defaultBaseUrl();
  const shownKey = apiKey || (token ? 'qk_<generated-on-copy>' : 'qk_<your-api-key>');
  const prompt = useMemo(() => setupPrompt(baseUrl, shownKey), [baseUrl, shownKey]);

  if (dismissed) return null;

  const copy = async () => {
    setError('');
    setLoading(true);
    try {
      let key = apiKey;
      if (token && !key) {
        const data = await api.post<{ token: string }>('/auth/api-keys', {
          label: 'AI setup prompt',
        });
        key = data.token;
        setApiKey(key);
      }
      await navigator.clipboard.writeText(setupPrompt(baseUrl, key || shownKey));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (err: any) {
      setError(err.message || 'Could not copy prompt.');
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <section className={s.card}>
      <div className={s.head}>
        <div>
          <p className={s.kicker}>AI setup prompt</p>
          <h2 className={s.title}>Ask your coding agent to wire up Quokka</h2>
          <p className={s.intro}>
            {intro || 'Copy this into Cursor, Claude Code, or another coding agent. If you are signed in, Quokka creates an API key on copy and inserts it into the prompt.'}
          </p>
        </div>
        {dismissible && (
          <button className={s.dismiss} onClick={dismiss} aria-label="Dismiss setup prompt">
            x
          </button>
        )}
      </div>

      <div className={s.code}>
        <div className={s.codeBar}>
          <span className={s.codeLang}>prompt</span>
          <Button size="xs" variant="secondary" loading={loading} onClick={copy}>
            {copied ? 'Copied' : token ? 'Generate key & copy' : 'Copy prompt'}
          </Button>
        </div>
        <pre className={s.codePre}><code>{prompt}</code></pre>
      </div>

      {!token && (
        <p className={s.note}>
          <Link to="/login">Sign in</Link> to generate a real API key automatically.
        </p>
      )}
      {error && <p className={s.error}>{error}</p>}
    </section>
  );
}
