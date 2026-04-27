import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Page } from '../components/Page';
import s from './ProjectsPage.module.css';
import p from './shared.module.css';

type Visibility = 'team' | 'private';

interface Project {
  id: string;
  slug: string;
  name: string;
  visibility: Visibility;
  pinned: boolean;
  accessUserIds: string[];
  _count: { runs: number };
}

interface TeamMeta {
  myRole: 'owner' | 'team_admin' | 'member' | null;
  members: { user: { id: string; email: string; name: string } }[];
}

interface Me {
  id: string;
  isSuperAdmin?: boolean;
}

export function ProjectsPage() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('team');
  const [accessUserIds, setAccessUserIds] = useState<string[]>([]);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', teamSlug],
    queryFn: () => api.get<Project[]>('/teams/' + teamSlug + '/projects'),
  });
  const { data: team } = useQuery({
    queryKey: ['team', teamSlug],
    queryFn: () => api.get<TeamMeta>('/teams/' + teamSlug),
  });
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/auth/me'),
  });
  const canManageTeam =
    !!me?.isSuperAdmin || team?.myRole === 'owner' || team?.myRole === 'team_admin';

  const createMut = useMutation({
    mutationFn: () => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return api.post('/teams/' + teamSlug + '/projects', {
        name,
        slug,
        visibility,
        accessUserIds: visibility === 'private' ? accessUserIds : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', teamSlug] });
      setShowCreate(false);
      setName('');
      setVisibility('team');
      setAccessUserIds([]);
    },
  });
  const togglePinMut = useMutation({
    mutationFn: ({ slug, pinned }: { slug: string; pinned: boolean }) =>
      pinned
        ? api.delete('/teams/' + teamSlug + '/projects/' + slug + '/pin')
        : api.post('/teams/' + teamSlug + '/projects/' + slug + '/pin', {}),
    onMutate: async ({ slug, pinned }) => {
      await qc.cancelQueries({ queryKey: ['projects', teamSlug] });
      const prev = qc.getQueryData<Project[]>(['projects', teamSlug]);
      qc.setQueryData<Project[]>(['projects', teamSlug], (xs) =>
        (xs || []).map((p) => (p.slug === slug ? { ...p, pinned: !pinned } : p)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['projects', teamSlug], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['projects', teamSlug] }),
  });

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [projects]);

  const teamMembers = team?.members || [];

  return (
    <Page>
      <div className={p.pageHead}>
        <div className={p.breadcrumb}>
          <Link to="/">Teams</Link>
          <span className={p.breadcrumbSep}>/</span>
          <span className={[p.breadcrumbCurrent, p.h1Caps].join(' ')}>{teamSlug}</span>
        </div>
        <div className={p.titleRow}>
          <h1 className={[p.h1, p.h1Caps].join(' ')}>{teamSlug}</h1>
          <div className={s.headActions}>
            {canManageTeam && (
              <Link to={'/' + teamSlug + '/team'}>
                <Button size="sm" variant="ghost">Team settings</Button>
              </Link>
            )}
            <Button
              size="sm"
              variant={showCreate ? 'ghost' : 'secondary'}
              onClick={() => setShowCreate(!showCreate)}
            >
              {showCreate ? 'Cancel' : 'New project'}
            </Button>
          </div>
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
          className={s.createForm}
        >
          <div className={s.createField}>
            <Input label="Project name" placeholder="my-awesome-project"
              value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className={s.createVis}>
            <label className={s.fieldLabel}>Visibility</label>
            <div className={s.segmented}>
              <button
                type="button"
                className={visibility === 'team' ? s.segOn : s.seg}
                onClick={() => setVisibility('team')}
              >
                Team
              </button>
              <button
                type="button"
                className={visibility === 'private' ? s.segOn : s.seg}
                onClick={() => setVisibility('private')}
              >
                Private
              </button>
            </div>
          </div>
          <Button type="submit" loading={createMut.isPending} disabled={!name.trim()}>
            Create
          </Button>
          {visibility === 'private' && (
            <div className={s.accessPicker}>
              <label className={s.fieldLabel}>Allowed users</label>
              <div className={s.checkList}>
                {teamMembers.map((m) => {
                  const checked = accessUserIds.includes(m.user.id);
                  const isMe = m.user.id === me?.id;
                  return (
                    <label key={m.user.id} className={s.checkRow}>
                      <input
                        type="checkbox"
                        checked={checked || isMe}
                        disabled={isMe}
                        onChange={(e) =>
                          setAccessUserIds((prev) =>
                            e.target.checked
                              ? Array.from(new Set([...prev, m.user.id]))
                              : prev.filter((id) => id !== m.user.id),
                          )
                        }
                      />
                      <span>{m.user.name}</span>
                      <span className={s.checkMeta}>{m.user.email}</span>
                      {isMe && <span className={s.checkSelf}>you</span>}
                    </label>
                  );
                })}
              </div>
              <p className={s.hint}>You're always added. Owners and team admins can manage access later.</p>
            </div>
          )}
        </form>
      )}

      {isLoading ? (
        <div className={s.grid}>
          {[1, 2, 3].map((i) => <div key={i} className={s.skeleton} />)}
        </div>
      ) : !projects?.length ? (
        <div className={p.empty}>
          <div className={p.emptyIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <p className={p.emptyTitle}>No projects yet</p>
          <p className={p.emptyHint}>Create one, or push data from the SDK</p>
        </div>
      ) : (
        <div className={s.grid}>
          {sortedProjects.map((proj) => (
            <Link key={proj.id} to={'/' + teamSlug + '/' + proj.slug} className={s.card}>
              <button
                type="button"
                className={proj.pinned ? s.pinOn : s.pin}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePinMut.mutate({ slug: proj.slug, pinned: proj.pinned });
                }}
                title={proj.pinned ? 'Unpin' : 'Pin to top'}
                aria-label={proj.pinned ? 'Unpin project' : 'Pin project'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={proj.pinned ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 17v5" />
                  <path d="M9 11V4h6v7l3 3v2H6v-2l3-3z" />
                </svg>
              </button>
              <div className={s.badge}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.75"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className={s.name}>
                {proj.name}
                {proj.visibility === 'private' && (
                  <span className={s.visTag} title="Private project">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                )}
              </div>
              <div className={s.runs}>
                {proj._count.runs} {proj._count.runs === 1 ? 'run' : 'runs'}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
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
