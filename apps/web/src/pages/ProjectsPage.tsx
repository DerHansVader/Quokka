import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Page } from '../components/Page';
import s from './ProjectsPage.module.css';
import p from './shared.module.css';

interface Project {
  id: string;
  slug: string;
  name: string;
  _count: { runs: number };
}

interface TeamMeta {
  myRole: 'owner' | 'admin' | 'member';
}

export function ProjectsPage() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', teamSlug],
    queryFn: () => api.get<Project[]>('/teams/' + teamSlug + '/projects'),
  });
  const { data: team } = useQuery({
    queryKey: ['team', teamSlug],
    queryFn: () => api.get<TeamMeta>('/teams/' + teamSlug),
  });
  const canManageTeam = team?.myRole === 'owner' || team?.myRole === 'admin';

  const createMut = useMutation({
    mutationFn: () => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return api.post('/teams/' + teamSlug + '/projects', { name, slug });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', teamSlug] });
      setShowCreate(false);
      setName('');
    },
  });

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
          <Button type="submit" loading={createMut.isPending} disabled={!name.trim()}>
            Create
          </Button>
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
          {projects.map((proj) => (
            <Link key={proj.id} to={'/' + teamSlug + '/' + proj.slug} className={s.card}>
              <div className={s.badge}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.75"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className={s.name}>{proj.name}</div>
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
