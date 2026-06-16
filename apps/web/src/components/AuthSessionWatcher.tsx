import { useEffect } from 'react';
import { getTokenExpiresAt } from '../lib/authSession';
import { useAuthStore } from '../stores/auth';

/** Log out when the JWT reaches its expiry time, even without API traffic. */
export function AuthSessionWatcher() {
  const { token, sessionExpired } = useAuthStore();

  useEffect(() => {
    if (!token) return;
    const expiresAt = getTokenExpiresAt(token);
    if (expiresAt == null) return;

    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      sessionExpired();
      return;
    }

    const id = window.setTimeout(sessionExpired, delay);
    return () => window.clearTimeout(id);
  }, [token, sessionExpired]);

  return null;
}
