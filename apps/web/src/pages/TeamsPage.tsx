import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
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

type Action = 'create' | 'join' | null;

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function TeamsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [action, setAction] = useState<Action>(null);

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<Team[]>('/teams'),
  });

  const hasTeams = !!teams?.length;

  return (
    <Page>
      <div className={p.pageHead}>
        <div className={s.headRow}>
          <div>
            <h1 className={p.h1}>Teams</h1>
            <p className={p.subtitle}>Select a team to view its projects.</p>
          </div>
          {hasTeams && (
            <div className={s.headActions}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAction(action === 'join' ? null : 'join')}
              >
                Join with key
              </Button>
              <Button
                size="sm"
                onClick={() => setAction(action === 'create' ? null : 'create')}
              >
                Create team
              </Button>
            </div>
          )}
        </div>

        {hasTeams && action && (
          <div className={s.actionPanel}>
            {action === 'create' ? (
              <CreateTeamForm
                onCancel={() => setAction(null)}
                onCreated={(slug) => {
                  setAction(null);
                  qc.invalidateQueries({ queryKey: ['teams'] });
                  navigate('/' + slug);
                }}
              />
            ) : (
              <JoinTeamForm
                onCancel={() => setAction(null)}
                onJoined={() => {
                  setAction(null);
                  qc.invalidateQueries({ queryKey: ['teams'] });
                }}
              />
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className={s.list}>
          {[1, 2, 3].map((i) => <div key={i} className={s.skeleton} />)}
        </div>
      ) : !hasTeams ? (
        <EmptyState
          onCreated={(slug) => {
            qc.invalidateQueries({ queryKey: ['teams'] });
            navigate('/' + slug);
          }}
          onJoined={() => qc.invalidateQueries({ queryKey: ['teams'] })}
        />
      ) : (
        <div className={s.list}>
          {teams!.map((team) => (
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

function CreateTeamForm({
  onCancel, onCreated, autoFocus = true,
}: { onCancel?: () => void; onCreated: (slug: string) => void; autoFocus?: boolean }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post<Team>('/teams', { name: name.trim(), slug: slugify(name) }),
    onSuccess: (team) => onCreated(team.slug),
    onError: (err: any) => setError(err.message || 'Could not create team.'),
  });

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) return;
        mut.mutate();
      }}
    >
      <div className={s.formField}>
        <Input
          label="Team name"
          placeholder="Acme Research"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={autoFocus}
          error={error || undefined}
          hint={!error && name ? 'URL: /' + slugify(name) : undefined}
        />
      </div>
      <div className={s.formActions}>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" size="sm" loading={mut.isPending} disabled={!name.trim()}>
          Create team
        </Button>
      </div>
    </form>
  );
}

function JoinTeamForm({
  onCancel, onJoined, autoFocus = true,
}: { onCancel?: () => void; onJoined: () => void; autoFocus?: boolean }) {
  const [inviteKey, setInviteKey] = useState('');
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post('/teams/join', { inviteKey: inviteKey.trim() }),
    onSuccess: () => { setInviteKey(''); onJoined(); },
    onError: (err: any) => setError(err.message || 'Could not join team.'),
  });

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        if (!inviteKey.trim()) return;
        mut.mutate();
      }}
    >
      <div className={s.formField}>
        <Input
          label="Invite key"
          placeholder="qki_..."
          value={inviteKey}
          onChange={(e) => setInviteKey(e.target.value)}
          autoFocus={autoFocus}
          error={error || undefined}
        />
      </div>
      <div className={s.formActions}>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" size="sm" loading={mut.isPending} disabled={!inviteKey.trim()}>
          Join team
        </Button>
      </div>
    </form>
  );
}

function EmptyState({
  onCreated, onJoined,
}: { onCreated: (slug: string) => void; onJoined: () => void }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyCard}>
        <h2 className={s.emptyTitle}>Create your first team</h2>
        <p className={s.emptySub}>Teams hold projects, runs, and members.</p>
        <CreateTeamForm onCreated={onCreated} autoFocus={false} />
      </div>
      <div className={s.emptyDivider}>or</div>
      <div className={s.emptyCard}>
        <h2 className={s.emptyTitle}>Join with an invite key</h2>
        <p className={s.emptySub}>Paste a key from a teammate to join their team.</p>
        <JoinTeamForm onJoined={onJoined} autoFocus={false} />
      </div>
    </div>
  );
}
