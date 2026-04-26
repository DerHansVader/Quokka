import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { AuthShell } from '../components/AuthShell';
import a from './Auth.module.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setToken } = useAuthStore();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.post<{ token: string }>('/auth/login', { email, password });
      setToken(token);
      nav('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue" error={error}>
      <form onSubmit={submit} className={a.form}>
        <Input label="Email" type="email" placeholder="you@company.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" required />
        <Input label="Password" type="password" placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password" required />
        <div className={a.submitRow}>
          <Button type="submit" size="lg" loading={loading} className={a.submit}>
            Sign in
          </Button>
        </div>
      </form>
      <p className={a.footer}>
        No account? <Link to="/signup" className={a.footerLink}>Create one</Link>
        {' · '}
        <Link to="/docs" className={a.footerLink}>Docs</Link>
      </p>
    </AuthShell>
  );
}
