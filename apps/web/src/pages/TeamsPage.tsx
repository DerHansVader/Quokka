import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Page } from '../components/Page';
import s from './TeamsPage.module.css';
import p from './shared.module.css';

interface Team {
  id: string;
  slug: string;
  name: string;
  _count: { projects: number; members: number };
}

export function TeamsPage() {
  const qc = useQueryClient();
  const [inviteKey, setInviteKey] = useState('');
  const [message, setMessage] = useState('');
  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<Team[]>('/teams'),
  });
  const joinMut = useMutation({
    mutationFn: () => api.post('/teams/join', { inviteKey }),
    onSuccess: () => {
      setInviteKey('');
      setMessage('Joined team.');
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: any) => setMessage(err.message || 'Could not join team.'),
  });

  return (
    <Page>
      <div className={p.pageHead}>
        <h1 className={p.h1}>Teams</h1>
        <p className={p.subtitle}>Select a team to view its projects</p>
      </div>

      <form
        className={s.joinCard}
        onSubmit={(e) => {
          e.preventDefault();
          setMessage('');
          if (inviteKey.trim()) joinMut.mutate();
        }}
      >
        <div className={s.joinField}>
          <Input
            label="Invite key"
            placeholder="qki_..."
            value={inviteKey}
            onChange={(e) => setInviteKey(e.target.value)}
          />
        </div>
        <Button type="submit" loading={joinMut.isPending} disabled={!inviteKey.trim()}>
          Join team
        </Button>
        {message && <p className={s.joinMessage}>{message}</p>}
      </form>

      {isLoading ? (
        <div className={s.list}>
          {[1, 2, 3].map((i) => <div key={i} className={s.skeleton} />)}
        </div>
      ) : !teams?.length ? (
        <div className={p.empty}>
          <div className={p.emptyIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className={p.emptyTitle}>No teams yet</p>
          <p className={p.emptyHint}>Create your account to get started</p>
        </div>
      ) : (
        <div className={s.list}>
          {teams.map((team) => (
            <Link key={team.id} to={'/' + team.slug} className={s.row}>
              <div className={s.mono}>{team.name.charAt(0).toUpperCase()}</div>
              <div className={s.info}>
                <div className={s.title}>{team.name}</div>
                <div className={s.meta}>
                  {team._count.projects} {team._count.projects === 1 ? 'project' : 'projects'}
                  {' · '}
                  {team._count.members} {team._count.members === 1 ? 'member' : 'members'}
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" className={s.chev}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
