import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { AuthShell } from '../components/AuthShell';
import a from './Auth.module.css';

export function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setToken } = useAuthStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get('invite') || undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { token } = await api.post<{ token: string }>('/auth/signup',
        { name, email, password, inviteToken });
      setToken(token);
      nav('/');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle={inviteToken ? 'Joining via team invite' : 'Get started with Quokka'}
      error={error}
    >
      <form onSubmit={submit} className={a.form}>
        <Input label="Name" placeholder="Alex Chen"
          value={name} onChange={(e) => setName(e.target.value)}
          autoComplete="name" required />
        <Input label="Email" type="email" placeholder="you@company.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" required />
        <Input label="Password" type="password" placeholder="At least 8 characters"
          value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password" required />
        <div className={a.submitRow}>
          <Button type="submit" size="lg" loading={loading} className={a.submit}>
            Create account
          </Button>
        </div>
      </form>
      <p className={a.footer}>
        Have an account? <Link to="/login" className={a.footerLink}>Sign in</Link>
      </p>
    </AuthShell>
  );
}
