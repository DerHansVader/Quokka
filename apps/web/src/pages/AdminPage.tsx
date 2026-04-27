import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { Page } from '../components/Page';
import s from './AdminPage.module.css';
import p from './shared.module.css';

interface Me {
  id: string;
  email: string;
  name: string;
  isSuperAdmin?: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  createdAt: string;
  memberships: {
    role: 'owner' | 'team_admin' | 'member';
    team: { id: string; slug: string; name: string };
  }[];
}

interface AdminTeam {
  id: string;
  slug: string;
  name: string;
  _count: { projects: number; members: number };
}

const MEMBER_ROLE_LABEL: Record<AdminUser['memberships'][number]['role'], string> = {
  owner: 'Owner',
  team_admin: 'Team admin',
  member: 'Member',
};

export function AdminPage() {
  const qc = useQueryClient();

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/auth/me'),
  });

  const isSuper = !!me?.isSuperAdmin;

  const { data: users = [] } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<AdminUser[]>('/admin/users'),
    enabled: isSuper,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => api.get<AdminTeam[]>('/admin/teams'),
    enabled: isSuper,
  });

  const promoteMut = useMutation({
    mutationFn: ({ id, isSuperAdmin }: { id: string; isSuperAdmin: boolean }) =>
      api.patch('/admin/users/' + id, { isSuperAdmin }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  const resetMut = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      api.post('/admin/users/' + id + '/reset-password', { newPassword }),
  });
  const deleteUserMut = useMutation({
    mutationFn: (id: string) => api.delete('/admin/users/' + id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  const deleteTeamMut = useMutation({
    mutationFn: (id: string) => api.delete('/admin/teams/' + id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'teams'] }),
  });

  const usersSorted = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          Number(b.isSuperAdmin) - Number(a.isSuperAdmin) ||
          a.name.localeCompare(b.name),
      ),
    [users],
  );

  if (meLoading) return <Page><div className={p.empty} /></Page>;

  if (!isSuper) {
    return <Navigate to="/" replace />;
  }

  const promptResetPassword = (u: AdminUser) => {
    const pw = window.prompt(`New password for ${u.name} (min 8 chars)`);
    if (!pw || pw.length < 8) return;
    resetMut.mutate(
      { id: u.id, newPassword: pw },
      { onSuccess: () => alert(`Password reset for ${u.email}`) },
    );
  };

  return (
    <Page>
      <div className={p.pageHead}>
        <h1 className={p.h1}>Admin</h1>
        <p className={p.subtitle}>
          Instance-wide control. One Quokka instance is one company; every team and user lives here.
        </p>
      </div>

      <section className={s.section}>
        <div className={s.sectionHead}>
          <div className={s.sectionTitle}>Users · {users.length}</div>
        </div>
        <div className={s.list}>
          {usersSorted.map((u) => {
            const isSelf = u.id === me?.id;
            return (
              <div key={u.id} className={s.row}>
                <div className={s.avatar}>{u.name.charAt(0).toUpperCase()}</div>
                <div className={s.info}>
                  <div className={s.name}>
                    {u.name}
                    {isSelf && <span className={s.selfTag}>you</span>}
                    {u.isSuperAdmin && <span className={s.superTag}>Super admin</span>}
                  </div>
                  <div className={s.meta}>{u.email}</div>
                  <div className={s.teams}>
                    {u.memberships.length === 0
                      ? <span className={s.metaSubtle}>No teams</span>
                      : u.memberships.map((m) => (
                          <span key={m.team.id} className={s.teamPill}>
                            {m.team.name} · {MEMBER_ROLE_LABEL[m.role]}
                          </span>
                        ))}
                  </div>
                </div>
                <div className={s.actions}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      promoteMut.mutate({ id: u.id, isSuperAdmin: !u.isSuperAdmin })
                    }
                    disabled={isSelf && u.isSuperAdmin}
                    title={isSelf && u.isSuperAdmin ? 'Promote another user first' : undefined}
                  >
                    {u.isSuperAdmin ? 'Demote' : 'Make super admin'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => promptResetPassword(u)}>
                    Reset password
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isSelf}
                    onClick={() => {
                      if (confirm(`Delete user ${u.email}? Their runs and api keys will be removed.`)) {
                        deleteUserMut.mutate(u.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={s.section}>
        <div className={s.sectionHead}>
          <div className={s.sectionTitle}>Teams · {teams.length}</div>
        </div>
        <div className={s.list}>
          {teams.length === 0 ? (
            <p className={s.metaSubtle}>No teams yet.</p>
          ) : (
            teams.map((t) => (
              <div key={t.id} className={s.row}>
                <div className={s.avatar} data-variant="team">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className={s.info}>
                  <div className={s.name}>{t.name}</div>
                  <div className={s.meta}>
                    {t._count.members} {t._count.members === 1 ? 'member' : 'members'} ·{' '}
                    {t._count.projects} {t._count.projects === 1 ? 'project' : 'projects'}
                  </div>
                </div>
                <div className={s.actions}>
                  <Link to={'/' + t.slug}>
                    <Button size="sm" variant="ghost">Open</Button>
                  </Link>
                  <Link to={'/' + t.slug + '/team'}>
                    <Button size="sm" variant="ghost">Manage</Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete team ${t.name} and ALL its projects, runs, and metrics?`)) {
                        deleteTeamMut.mutate(t.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </Page>
  );
}
