const TOKEN_KEY = 'qk_token';
const EMAIL_KEY = 'qk_email';

export function getSavedEmail(): string {
  return localStorage.getItem(EMAIL_KEY) || '';
}

export function saveEmail(email: string): void {
  const trimmed = email.trim();
  if (trimmed) localStorage.setItem(EMAIL_KEY, trimmed);
  else localStorage.removeItem(EMAIL_KEY);
}

function parseJwtExp(token: string): number | null {
  try {
    const part = token.split('.')[1];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function getTokenExpiresAt(token: string): number | null {
  const exp = parseJwtExp(token);
  return exp == null ? null : exp * 1000;
}

export function isTokenExpired(token: string): boolean {
  const exp = parseJwtExp(token);
  if (exp == null) return false;
  return exp * 1000 <= Date.now();
}

export function readStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isTokenExpired(token)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const PUBLIC_PATHS = new Set(['/login', '/signup', '/docs']);

export function redirectToLoginIfNeeded(): void {
  const path = window.location.pathname;
  if (PUBLIC_PATHS.has(path)) return;
  window.location.assign('/login');
}
