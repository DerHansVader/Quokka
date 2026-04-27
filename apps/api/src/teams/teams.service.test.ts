import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TeamsService } from './teams.service';

const member = (id: string, isSuperAdmin = false) => ({ id, isSuperAdmin });

function serviceWith(prisma: any) {
  return new TeamsService(prisma);
}

describe('TeamsService invite keys', () => {
  it('creates host-independent invite keys', async () => {
    const prisma = {
      teamMember: {
        findUnique: vi.fn().mockResolvedValue({ role: 'team_admin' }),
      },
      invite: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };

    const invite = await serviceWith(prisma).inviteMember('team-1', member('user-1'), {
      email: 'teammate@example.com',
      role: 'member',
    });

    expect(invite.token).toMatch(/^qki_/);
    expect(invite.token).not.toContain('/');
    expect(invite.token).not.toContain('http');
  });

  it('lets an existing user join by invite key and consumes it', async () => {
    const invite = {
      id: 'invite-1',
      teamId: 'team-1',
      role: 'member',
      expiresAt: new Date(Date.now() + 1000),
    };
    const prisma = {
      invite: {
        findUnique: vi.fn().mockResolvedValue(invite),
        delete: vi.fn().mockResolvedValue({}),
      },
      teamMember: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'membership-1' }),
      },
    };

    await expect(
      serviceWith(prisma).joinByInviteKey(member('user-1'), ' qki_key '),
    ).resolves.toEqual({ id: 'membership-1' });

    expect(prisma.invite.findUnique).toHaveBeenCalledWith({ where: { token: 'qki_key' } });
    expect(prisma.teamMember.create).toHaveBeenCalledWith({
      data: { teamId: 'team-1', userId: 'user-1', role: 'member' },
    });
    expect(prisma.invite.delete).toHaveBeenCalledWith({ where: { id: 'invite-1' } });
  });

  it('rejects expired invite keys', async () => {
    const prisma = {
      invite: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date(Date.now() - 1000),
        }),
      },
    };

    await expect(
      serviceWith(prisma).joinByInviteKey(member('user-1'), 'qki_old'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('consumes the invite without creating a duplicate when already a member', async () => {
    const invite = {
      id: 'invite-1',
      teamId: 'team-1',
      role: 'member',
      expiresAt: new Date(Date.now() + 1000),
    };
    const existing = { id: 'membership-existing', teamId: 'team-1', userId: 'user-1' };
    const prisma = {
      invite: {
        findUnique: vi.fn().mockResolvedValue(invite),
        delete: vi.fn().mockResolvedValue({}),
      },
      teamMember: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
      },
    };

    await expect(
      serviceWith(prisma).joinByInviteKey(member('user-1'), 'qki_key'),
    ).resolves.toEqual(existing);
    expect(prisma.teamMember.create).not.toHaveBeenCalled();
    expect(prisma.invite.delete).toHaveBeenCalledWith({ where: { id: 'invite-1' } });
  });

  it('rejects empty/whitespace invite keys', async () => {
    const prisma = { invite: { findUnique: vi.fn() } };
    await expect(
      serviceWith(prisma).joinByInviteKey(member('user-1'), '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.invite.findUnique).not.toHaveBeenCalled();
  });
});

describe('TeamsService super admin & role rename', () => {
  it('only owners and team admins can manage', async () => {
    const prisma = {
      teamMember: { findUnique: vi.fn().mockResolvedValue({ role: 'member' }) },
    };
    await expect(
      serviceWith(prisma).requireManager('team-1', member('user-1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets super admins act on teams they are not a member of', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = { teamMember: { findUnique } };
    const svc = serviceWith(prisma);

    await expect(svc.requireMembership('team-1', member('u', true))).resolves.toBeNull();
    await expect(svc.requireManager('team-1', member('u', true))).resolves.toBe('super');
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('listForUser returns every team for super admins', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { team: { findMany } };
    await serviceWith(prisma).listForUser(member('u', true));
    expect(findMany.mock.calls[0][0].where).toEqual({});
  });

  it('listForUser scopes to memberships for normal users', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { team: { findMany } };
    await serviceWith(prisma).listForUser(member('u-1'));
    expect(findMany.mock.calls[0][0].where).toEqual({
      members: { some: { userId: 'u-1' } },
    });
  });

  it('rejects non-managers from inviting', async () => {
    const prisma = {
      teamMember: { findUnique: vi.fn().mockResolvedValue({ role: 'member' }) },
      invite: { create: vi.fn() },
    };
    await expect(
      serviceWith(prisma).inviteMember('team-1', member('user-1'), { email: 'a@b.c' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.invite.create).not.toHaveBeenCalled();
  });

  it('lets super admins invite without a membership row', async () => {
    const prisma = {
      teamMember: { findUnique: vi.fn() },
      invite: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };
    const inv = await serviceWith(prisma).inviteMember(
      'team-1',
      member('root', true),
      { email: 'a@b.c', role: 'team_admin' },
    );
    expect(inv.role).toBe('team_admin');
    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });
});
