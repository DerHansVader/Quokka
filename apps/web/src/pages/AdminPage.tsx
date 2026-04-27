import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Page } from '../components/Page';
import s from './AdminPage.module.css';
import p from './shared.module.css';

interface Me {
  id: string;
  email: string;
  name: string;
  isSuperAdmin?: boolean;
}

type MemberRole = 'owner' | 'team_admin' | 'member';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  createdAt: string;
  memberships: {
    role: MemberRole;
    team: { id: string; slug: string; name: string };
  }[];
}

interface AdminTeam {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  _count: { projects: number; members: number };
}

const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Owner',
  team_admin: 'Team admin',
  member: 'Member',
};

export function AdminPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

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

  const invalidateUsers = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  const invalidateTeams = () => qc.invalidateQueries({ queryKey: ['admin', 'teams'] });

  const promoteMut = useMutation({
    mutationFn: ({ id, isSuperAdmin }: { id: string; isSuperAdmin: boolean }) =>
      api.patch('/admin/users/' + id, { isSuperAdmin }),
    onSuccess: invalidateUsers,
  });
  const resetMut = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      api.post('/admin/users/' + id + '/reset-password', { newPassword }),
  });
  const deleteUserMut = useMutation({
    mutationFn: (id: string) => api.delete('/admin/users/' + id),
    onSuccess: invalidateUsers,
  });
  const deleteTeamMut = useMutation({
    mutationFn: (id: string) => api.delete('/admin/teams/' + id),
    onSuccess: () => {
      invalidateTeams();
      invalidateUsers();
    },
  });
  const setMembershipMut = useMutation({
    mutationFn: ({ userId, teamId, role }: { userId: string; teamId: string; role: MemberRole }) =>
      api.put('/admin/users/' + userId + '/memberships/' + teamId, { role }),
    onSuccess: invalidateUsers,
  });
  const removeMembershipMut = useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string }) =>
      api.delete('/admin/users/' + userId + '/memberships/' + teamId),
    onSuccess: invalidateUsers,
  });
  const createUserMut = useMutation({
    mutationFn: (body: {
      email: string;
      name: string;
      password: string;
      isSuperAdmin?: boolean;
      memberships?: { teamId: string; role: MemberRole }[];
    }) => api.post('/admin/users', body),
    onSuccess: () => {
      invalidateUsers();
      setShowCreate(false);
    },
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
  if (!isSuper) return <Navigate to="/" replace />;

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
        <div className={p.titleRow}>
          <h1 className={p.h1}>Admin</h1>
          <Button
            size="sm"
            variant={showCreate ? 'ghost' : 'secondary'}
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? 'Cancel' : 'New user'}
          </Button>
        </div>
        <p className={p.subtitle}>
          Instance-wide control. One Quokka instance is one company; every team and user lives here.
        </p>
      </div>

      {showCreate && (
        <CreateUserForm
          teams={teams}
          loading={createUserMut.isPending}
          onSubmit={(body) => createUserMut.mutate(body)}
        />
      )}

      <section className={s.section}>
        <div className={s.sectionHead}>
          <div className={s.sectionTitle}>Users · {users.length}</div>
        </div>
        <div className={s.list}>
          {usersSorted.map((u) => {
            const isSelf = u.id === me?.id;
            const expanded = expandedUser === u.id;
            return (
              <div key={u.id} className={s.userBlock}>
                <div className={s.row}>
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
                      onClick={() => setExpandedUser(expanded ? null : u.id)}
                    >
                      {expanded ? 'Done' : 'Manage teams'}
                    </Button>
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
                {expanded && (
                  <UserMembershipsEditor
                    user={u}
                    teams={teams}
                    onSet={(teamId, role) =>
                      setMembershipMut.mutate({ userId: u.id, teamId, role })
                    }
                    onRemove={(teamId) =>
                      removeMembershipMut.mutate({ userId: u.id, teamId })
                    }
                    busy={setMembershipMut.isPending || removeMembershipMut.isPending}
                  />
                )}
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
                  {t.icon || t.name.charAt(0).toUpperCase()}
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

const ROLES: MemberRole[] = ['owner', 'team_admin', 'member'];

function UserMembershipsEditor({
  user,
  teams,
  onSet,
  onRemove,
  busy,
}: {
  user: AdminUser;
  teams: AdminTeam[];
  onSet: (teamId: string, role: MemberRole) => void;
  onRemove: (teamId: string) => void;
  busy: boolean;
}) {
  const byTeamId = new Map(user.memberships.map((m) => [m.team.id, m.role]));
  const [pickedTeam, setPickedTeam] = useState('');
  const [pickedRole, setPickedRole] = useState<MemberRole>('member');

  const candidateTeams = teams.filter((t) => !byTeamId.has(t.id));

  return (
    <div className={s.editor}>
      <div className={s.editorList}>
        {user.memberships.length === 0 ? (
          <p className={s.metaSubtle}>Not a member of any team yet.</p>
        ) : (
          user.memberships.map((m) => (
            <div key={m.team.id} className={s.editorRow}>
              <span className={s.editorTeam}>{m.team.name}</span>
              <select
                className={s.editorSelect}
                value={m.role}
                disabled={busy}
                onChange={(e) => onSet(m.team.id, e.target.value as MemberRole)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{MEMBER_ROLE_LABEL[r]}</option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Remove ${user.name} from ${m.team.name}?`)) onRemove(m.team.id);
                }}
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </div>

      {candidateTeams.length > 0 && (
        <form
          className={s.editorAdd}
          onSubmit={(e) => {
            e.preventDefault();
            if (!pickedTeam) return;
            onSet(pickedTeam, pickedRole);
            setPickedTeam('');
            setPickedRole('member');
          }}
        >
          <select
            className={s.editorSelect}
            value={pickedTeam}
            onChange={(e) => setPickedTeam(e.target.value)}
          >
            <option value="">Add to team…</option>
            {candidateTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            className={s.editorSelect}
            value={pickedRole}
            onChange={(e) => setPickedRole(e.target.value as MemberRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{MEMBER_ROLE_LABEL[r]}</option>
            ))}
          </select>
          <Button size="sm" type="submit" disabled={!pickedTeam || busy}>Add</Button>
        </form>
      )}
    </div>
  );
}

function CreateUserForm({
  teams,
  loading,
  onSubmit,
}: {
  teams: AdminTeam[];
  loading: boolean;
  onSubmit: (body: {
    email: string;
    name: string;
    password: string;
    isSuperAdmin?: boolean;
    memberships?: { teamId: string; role: MemberRole }[];
  }) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [superAdmin, setSuperAdmin] = useState(false);
  const [picks, setPicks] = useState<Record<string, MemberRole>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim() || password.length < 8) return;
    const memberships = Object.entries(picks).map(([teamId, role]) => ({ teamId, role }));
    onSubmit({
      email: email.trim(),
      name: name.trim(),
      password,
      isSuperAdmin: superAdmin || undefined,
      memberships: memberships.length ? memberships : undefined,
    });
  };

  return (
    <form onSubmit={submit} className={s.createForm}>
      <div className={s.createGrid}>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Initial password" type="password" value={password}
               onChange={(e) => setPassword(e.target.value)} hint="Min 8 characters" required />
        <label className={s.toggleRow}>
          <input
            type="checkbox"
            checked={superAdmin}
            onChange={(e) => setSuperAdmin(e.target.checked)}
          />
          <span>Make super admin</span>
        </label>
      </div>

      {teams.length > 0 && (
        <div>
          <div className={s.fieldLabel}>Add to teams</div>
          <div className={s.teamPicks}>
            {teams.map((t) => {
              const role = picks[t.id];
              const enabled = !!role;
              return (
                <div key={t.id} className={s.teamPickRow}>
                  <label className={s.teamPickName}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) =>
                        setPicks((prev) => {
                          const copy = { ...prev };
                          if (e.target.checked) copy[t.id] = 'member';
                          else delete copy[t.id];
                          return copy;
                        })
                      }
                    />
                    <span>{t.name}</span>
                  </label>
                  {enabled && (
                    <select
                      className={s.editorSelect}
                      value={role}
                      onChange={(e) =>
                        setPicks((prev) => ({ ...prev, [t.id]: e.target.value as MemberRole }))
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{MEMBER_ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={s.createActions}>
        <Button type="submit" loading={loading}>Create user</Button>
      </div>
    </form>
  );
}
