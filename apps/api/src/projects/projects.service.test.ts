import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProjectsService } from './projects.service';

const me = (id: string, isSuperAdmin = false) => ({ id, isSuperAdmin });

function svc(prisma: any, teamGetBySlug: any) {
  const teams: any = { getBySlug: teamGetBySlug };
  return new ProjectsService(prisma, teams);
}

describe('ProjectsService visibility', () => {
  it('hides private projects from non-allowlisted members', async () => {
    const team = { id: 'team-1', myRole: 'member' };
    const teamGetBySlug = vi.fn().mockResolvedValue(team);
    const prisma = {
      project: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', name: 'Public', visibility: 'team', access: [], pins: [] },
          { id: 'p2', name: 'Private', visibility: 'private', access: [{ userId: 'other' }], pins: [] },
          { id: 'p3', name: 'Mine',    visibility: 'private', access: [{ userId: 'u-1' }], pins: [] },
        ]),
      },
    };
    const out = await svc(prisma, teamGetBySlug).listForTeam('t', me('u-1'));
    expect(out.map((p: any) => p.id)).toEqual(['p1', 'p3']);
  });

  it('owners and team admins see every project', async () => {
    const team = { id: 'team-1', myRole: 'team_admin' };
    const teamGetBySlug = vi.fn().mockResolvedValue(team);
    const prisma = {
      project: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p2', name: 'Private', visibility: 'private', access: [], pins: [] },
        ]),
      },
    };
    const out = await svc(prisma, teamGetBySlug).listForTeam('t', me('u-1'));
    expect(out).toHaveLength(1);
  });

  it('super admins see every project even without membership', async () => {
    const team = { id: 'team-1', myRole: null };
    const teamGetBySlug = vi.fn().mockResolvedValue(team);
    const prisma = {
      project: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p2', name: 'Private', visibility: 'private', access: [], pins: [] },
        ]),
      },
    };
    const out = await svc(prisma, teamGetBySlug).listForTeam('t', me('root', true));
    expect(out).toHaveLength(1);
  });

  it('exposes pinned + accessUserIds and strips internals', async () => {
    const team = { id: 'team-1', myRole: 'owner' };
    const teamGetBySlug = vi.fn().mockResolvedValue(team);
    const prisma = {
      project: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'p',
            name: 'X',
            visibility: 'team',
            access: [{ userId: 'a' }],
            pins: [{ id: 'pin' }],
          },
        ]),
      },
    };
    const out = await svc(prisma, teamGetBySlug).listForTeam('t', me('u'));
    expect(out[0].pinned).toBe(true);
    expect(out[0].accessUserIds).toEqual(['a']);
    expect(out[0].access).toBeUndefined();
    expect(out[0].pins).toBeUndefined();
  });

  it('blocks reading a private project for unallowed members', async () => {
    const team = { id: 'team-1', myRole: 'member' };
    const teamGetBySlug = vi.fn().mockResolvedValue(team);
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'p',
          visibility: 'private',
          access: [{ userId: 'other', user: {} }],
          pins: [],
        }),
      },
    };
    await expect(
      svc(prisma, teamGetBySlug).getBySlug('t', 'p', me('u-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ProjectsService.create', () => {
  it('creates team-visible projects with no access rows', async () => {
    const team = { id: 'team-1', myRole: 'member' };
    const teamGetBySlug = vi.fn().mockResolvedValue(team);
    const prisma = {
      project: { create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)) },
    };
    const created = await svc(prisma, teamGetBySlug).create('t', me('u'), {
      name: 'P',
      slug: 'p',
    });
    expect(created.visibility).toBe('team');
    expect(created.access).toBeUndefined();
  });

  it('always includes the creator in private project access', async () => {
    const team = { id: 'team-1', myRole: 'member' };
    const teamGetBySlug = vi.fn().mockResolvedValue(team);
    const prisma = {
      project: { create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)) },
    };
    const created = await svc(prisma, teamGetBySlug).create('t', me('u'), {
      name: 'P',
      slug: 'p',
      visibility: 'private',
      accessUserIds: ['x'],
    });
    const ids = created.access.create.map((a: any) => a.userId).sort();
    expect(ids).toEqual(['u', 'x']);
  });
});

describe('ProjectsService pins', () => {
  it('upserts a pin when pinning', async () => {
    const team = { id: 'team-1', myRole: 'owner' };
    const teamGetBySlug = vi.fn().mockResolvedValue(team);
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'p1',
          visibility: 'team',
          access: [],
          pins: [],
        }),
      },
      projectPin: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const out = await svc(prisma, teamGetBySlug).pin('t', 'p1', me('u'));
    expect(out).toEqual({ pinned: true });
    expect(prisma.projectPin.upsert).toHaveBeenCalled();
  });
});
