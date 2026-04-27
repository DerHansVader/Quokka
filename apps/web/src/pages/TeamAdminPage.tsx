import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Page } from '../components/Page';
import s from './TeamAdminPage.module.css';
import p from './shared.module.css';

type Role = 'owner' | 'team_admin' | 'member';
const ROLES: Role[] = ['owner', 'team_admin', 'member'];
const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  team_admin: 'Team admin',
  member: 'Member',
};

interface Member {
  id: string;
  role: Role;
  user: { id: string; email: string; name: string };
}

interface Team {
  id: string;
  slug: string;
  name: string;
  myRole: Role;
  members: Member[];
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface Me {
  id: string;
  email: string;
  name: string;
  isSuperAdmin?: boolean;
}

const rolesYouCanAssign = (myRole: Role, target: Role): Role[] => {
  if (myRole === 'owner') return ROLES;
  if (myRole === 'team_admin') {
    if (target === 'owner') return ['owner'];
    return ['team_admin', 'member'];
  }
  return [target];
};

export function TeamAdminPage() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/auth/me'),
  });
  const { data: team, isLoading } = useQuery({
    queryKey: ['team', teamSlug],
    queryFn: () => api.get<Team>('/teams/' + teamSlug),
  });
  // Super admins can manage every team without being a member.
  const canManage =
    !!me?.isSuperAdmin || team?.myRole === 'owner' || team?.myRole === 'team_admin';

  const { data: invites = [] } = useQuery({
    queryKey: ['invites', teamSlug],
    queryFn: () => api.get<Invite[]>('/teams/' + teamSlug + '/invites'),
    enabled: !!team && canManage,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['team', teamSlug] });
    qc.invalidateQueries({ queryKey: ['invites', teamSlug] });
  };

  const inviteMut = useMutation({
    mutationFn: (body: { email: string; role: Role }) =>
      api.post<Invite>('/teams/' + teamSlug + '/invites', body),
    onSuccess: invalidate,
  });
  const revokeInviteMut = useMutation({
    mutationFn: (id: string) =>
      api.delete<void>('/teams/' + teamSlug + '/invites/' + id),
    onSuccess: invalidate,
  });
  const changeRoleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      api.patch<void>('/teams/' + teamSlug + '/members/' + userId, { role }),
    onSuccess: invalidate,
  });
  const removeMut = useMutation({
    mutationFn: (userId: string) =>
      api.delete<void>('/teams/' + teamSlug + '/members/' + userId),
    onSuccess: invalidate,
  });

  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [justCreated, setJustCreated] = useState<Invite | null>(null);

  const membersSorted = useMemo(() => {
    const order: Record<Role, number> = { owner: 0, team_admin: 1, member: 2 };
    return [...(team?.members ?? [])].sort(
      (a, b) => order[a.role] - order[b.role] || a.user.name.localeCompare(b.user.name),
    );
  }, [team]);

  if (isLoading || !team) {
    return <Page><div className={p.empty} /></Page>;
  }

  if (!canManage) {
    return (
      <Page>
        <div className={p.empty}>
          <p className={p.emptyTitle}>Access restricted</p>
          <p className={p.emptyHint}>Only team admins can manage members.</p>
          <div style={{ marginTop: 20 }}>
            <Button variant="secondary" onClick={() => nav('/' + team.slug)}>
              Back to projects
            </Button>
          </div>
        </div>
      </Page>
    );
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    inviteMut.mutate(
      { email: email.trim(), role: inviteRole },
      {
        onSuccess: (inv) => {
          setJustCreated(inv);
          setEmail('');
          setInviteRole('member');
        },
      },
    );
  };

  return (
    <Page>
      <div className={p.pageHead}>
        <div className={p.breadcrumb}>
          <Link to="/">Teams</Link>
          <span className={p.breadcrumbSep}>/</span>
          <Link to={'/' + team.slug}>{team.name}</Link>
          <span className={p.breadcrumbSep}>/</span>
          <span className={p.breadcrumbCurrent}>Team settings</span>
        </div>
        <div className={p.titleRow}>
          <h1 className={p.h1}>Team</h1>
        </div>
        <p className={p.subtitle}>Manage members, roles, and pending invites.</p>
      </div>

      {/* Invite */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <div className={s.sectionTitle}>Invite a member</div>
        </div>

        <form onSubmit={submitInvite} className={s.inviteForm}>
          <div className={s.inviteField}>
            <Input
              label="Email"
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={s.inviteRole}>
            <label className={s.fieldLabel}>Role</label>
            <select
              className={s.select}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
            >
              {(me?.isSuperAdmin || team.myRole === 'owner'
                ? ROLES
                : (['team_admin', 'member'] as Role[])
              ).map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
          <Button type="submit" loading={inviteMut.isPending} disabled={!email.trim()}>
            Create invite key
          </Button>
        </form>

        {justCreated && (
          <div className={s.inviteCreated}>
            <div className={s.inviteCreatedHead}>
              <span className={s.inviteCreatedKicker}>Invite key</span>
              <button
                className={s.linkBtn}
                onClick={() => setJustCreated(null)}
                title="Dismiss"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
            <div className={s.inviteLinkRow}>
              <code className={s.inviteLink}>{justCreated.token}</code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copy(justCreated.token)}
              >
                Copy
              </Button>
            </div>
            <p className={s.inviteHint}>
              Share this key with {justCreated.email}. They can paste it on signup or from the Teams page. Expires in 7 days.
            </p>
          </div>
        )}
      </section>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section className={s.section}>
          <div className={s.sectionHead}>
            <div className={s.sectionTitle}>Pending invites · {invites.length}</div>
          </div>
          <div className={s.list}>
            {invites.map((inv) => (
              <div key={inv.id} className={s.inviteRow}>
                <div className={s.avatar} data-variant="invite">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div className={s.info}>
                  <div className={s.name}>{inv.email}</div>
                  <div className={s.meta}>
                    Key {inv.token} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={s.roleTag}>{ROLE_LABEL[inv.role]}</span>
                <button
                  className={s.iconBtn}
                  onClick={() => copy(inv.token)}
                  title="Copy invite key"
                  aria-label="Copy invite key"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button
                  className={s.iconBtn}
                  onClick={() => {
                    if (confirm('Revoke invite for ' + inv.email + '?')) {
                      revokeInviteMut.mutate(inv.id);
                    }
                  }}
                  title="Revoke"
                  aria-label="Revoke"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Members */}
      <section className={s.section}>
        <div className={s.sectionHead}>
          <div className={s.sectionTitle}>Members · {team.members.length}</div>
        </div>
        <div className={s.list}>
          {membersSorted.map((m) => {
            const isSelf = m.user.id === me?.id;
            // Super admins act as if they were owners for role-assignment UI.
            const effectiveRole: Role = me?.isSuperAdmin ? 'owner' : team.myRole;
            const options = rolesYouCanAssign(effectiveRole, m.role);
            const canEditRole =
              options.length > 1 &&
              !(isSelf && m.role === 'owner'); // don't let owner demote themselves from UI; backend also prevents last-owner demotion
            const canRemove =
              !isSelf &&
              (effectiveRole === 'owner' || m.role !== 'owner');
            return (
              <div key={m.id} className={s.memberRow}>
                <div className={s.avatar}>{m.user.name.charAt(0).toUpperCase()}</div>
                <div className={s.info}>
                  <div className={s.name}>
                    {m.user.name}
                    {isSelf && <span className={s.selfTag}>you</span>}
                  </div>
                  <div className={s.meta}>{m.user.email}</div>
                </div>
                {canEditRole ? (
                  <select
                    className={s.roleSelect}
                    value={m.role}
                    disabled={changeRoleMut.isPending}
                    onChange={(e) =>
                      changeRoleMut.mutate({
                        userId: m.user.id,
                        role: e.target.value as Role,
                      })
                    }
                  >
                    {options.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                ) : (
                  <span className={s.roleTag}>{ROLE_LABEL[m.role]}</span>
                )}
                <button
                  className={s.iconBtn}
                  disabled={!canRemove}
                  onClick={() => {
                    if (confirm('Remove ' + m.user.name + ' from the team?')) {
                      removeMut.mutate(m.user.id);
                    }
                  }}
                  title={canRemove ? 'Remove member' : 'Cannot remove'}
                  aria-label="Remove member"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </Page>
  );
}
