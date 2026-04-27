import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

function serviceWith(prisma: any) {
  return new AuthService(prisma, { sign: vi.fn(() => 'jwt-token') } as any);
}

describe('AuthService', () => {
  it('changes the current user password after verifying the old password', async () => {
    const oldHash = await bcrypt.hash('old-password', 4);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user-1', passwordHash: oldHash }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    await expect(
      serviceWith(prisma).changePassword('user-1', {
        currentPassword: 'old-password',
        newPassword: 'new-password',
      }),
    ).resolves.toEqual({ ok: true });

    const updateArg = prisma.user.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'user-1' });
    await expect(bcrypt.compare('new-password', updateArg.data.passwordHash)).resolves.toBe(true);
  });

  it('rejects password changes with the wrong current password', async () => {
    const oldHash = await bcrypt.hash('old-password', 4);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'user-1', passwordHash: oldHash }),
        update: vi.fn(),
      },
    };

    await expect(
      serviceWith(prisma).changePassword('user-1', {
        currentPassword: 'wrong',
        newPassword: 'new-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('accepts inviteKey during signup and consumes the invite', async () => {
    const invite = {
      id: 'invite-1',
      teamId: 'team-1',
      role: 'member',
      expiresAt: new Date(Date.now() + 1000),
    };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({ id: 'user-1' }),
      },
      invite: {
        findUnique: vi.fn().mockResolvedValue(invite),
        delete: vi.fn().mockResolvedValue({}),
      },
      teamMember: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    await expect(
      serviceWith(prisma).signup({
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
        inviteKey: 'qki_invite',
      }),
    ).resolves.toEqual({ token: 'jwt-token' });

    expect(prisma.invite.findUnique).toHaveBeenCalledWith({ where: { token: 'qki_invite' } });
    expect(prisma.teamMember.create).toHaveBeenCalledWith({
      data: { teamId: 'team-1', userId: 'user-1', role: 'member' },
    });
    expect(prisma.invite.delete).toHaveBeenCalledWith({ where: { id: 'invite-1' } });
  });

  it('requires an invite key after the first user', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(1),
      },
    };

    await expect(
      serviceWith(prisma).signup({
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('promotes the very first user to super admin (one company per instance)', async () => {
    const userCreate = vi.fn().mockResolvedValue({ id: 'user-1' });
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: userCreate,
      },
      team: { create: vi.fn().mockResolvedValue({ id: 'team-1' }) },
      teamMember: { create: vi.fn().mockResolvedValue({}) },
    };

    await serviceWith(prisma).signup({
      email: 'first@example.com',
      name: 'First',
      password: 'password123',
    });

    expect(userCreate.mock.calls[0][0].data.isSuperAdmin).toBe(true);
  });

  it('does not auto-promote subsequent users to super admin', async () => {
    const userCreate = vi.fn().mockResolvedValue({ id: 'user-2' });
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(1),
        create: userCreate,
      },
      invite: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'invite-1',
          teamId: 'team-1',
          role: 'member',
          expiresAt: new Date(Date.now() + 1000),
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
      teamMember: { create: vi.fn().mockResolvedValue({}) },
    };

    await serviceWith(prisma).signup({
      email: 'second@example.com',
      name: 'Second',
      password: 'password123',
      inviteKey: 'qki_x',
    });

    expect(userCreate.mock.calls[0][0].data.isSuperAdmin).toBe(false);
  });
});
