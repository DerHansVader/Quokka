import { describe, expect, it, beforeEach } from 'vitest';
import { getSavedEmail, isTokenExpired, readStoredToken, saveEmail } from './authSession';

function makeToken(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-1', exp: expSeconds }));
  return `${header}.${payload}.sig`;
}

describe('authSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('remembers email', () => {
    expect(getSavedEmail()).toBe('');
    saveEmail('max@max.de');
    expect(getSavedEmail()).toBe('max@max.de');
  });

  it('drops expired tokens on read', () => {
    const expired = makeToken(Math.floor(Date.now() / 1000) - 60);
    localStorage.setItem('qk_token', expired);
    expect(readStoredToken()).toBeNull();
    expect(localStorage.getItem('qk_token')).toBeNull();
  });

  it('keeps valid tokens on read', () => {
    const valid = makeToken(Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem('qk_token', valid);
    expect(readStoredToken()).toBe(valid);
    expect(isTokenExpired(valid)).toBe(false);
  });
});
