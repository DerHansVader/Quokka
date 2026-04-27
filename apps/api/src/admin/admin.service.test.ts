import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcrypt';
import { AdminService } from './admin.service';

function svc(prisma: any) {
  return new AdminService(prisma);
}

describe('AdminService', () => {
  it('promotes a user to super admin', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'u', isSuperAdmin: true });
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'u', isSuperAdmin: false }),
        update,
      },
    };
    await svc(prisma).setSuperAdmin('actor', 'u', true);
    expect(update.mock.calls[0][0].data).toEqual({ isSuperAdmin: true });
  });

  it('refuses to demote the last super admin', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'u', isSuperAdmin: true }),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn(),
      },
    };
    await expect(svc(prisma).setSuperAdmin('actor', 'u', false)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('demotes a super admin when others remain', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'u', isSuperAdmin: true }),
        count: vi.fn().mockResolvedValue(1),
        update,
      },
    };
    await svc(prisma).setSuperAdmin('actor', 'u', false);
    expect(update.mock.calls[0][0].data).toEqual({ isSuperAdmin: false });
  });

  it('refuses self-deletion', async () => {
    const prisma = { user: { findUnique: vi.fn(), delete: vi.fn() } };
    await expect(svc(prisma).deleteUser('me', 'me')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete a missing user', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null), delete: vi.fn() },
    };
    await expect(svc(prisma).deleteUser('actor', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to delete the last super admin', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'u', isSuperAdmin: true }),
        count: vi.fn().mockResolvedValue(0),
        delete: vi.fn(),
      },
    };
    await expect(svc(prisma).deleteUser('actor', 'u')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('hashes the password on reset', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'u' });
    const prisma = { user: { update } };
    await svc(prisma).resetPassword('u', 'newpassword');
    const stored = update.mock.calls[0][0].data.passwordHash;
    expect(stored).not.toEqual('newpassword');
    await expect(bcrypt.compare('newpassword', stored)).resolves.toBe(true);
  });
});

describe('AdminService memberships', () => {
  it('upserts a membership row', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'm' });
    const prisma = {
      team: { findUnique: vi.fn().mockResolvedValue({ id: 't' }) },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u' }) },
      teamMember: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert,
      },
    };
    await svc(prisma).setMembership('u', 't', 'team_admin');
    expect(upsert.mock.calls[0][0].update).toEqual({ role: 'team_admin' });
    expect(upsert.mock.calls[0][0].create).toEqual({
      teamId: 't',
      userId: 'u',
      role: 'team_admin',
    });
  });

  it('refuses to demote the last owner', async () => {
    const prisma = {
      team: { findUnique: vi.fn().mockResolvedValue({ id: 't' }) },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u' }) },
      teamMember: {
        findUnique: vi.fn().mockResolvedValue({ role: 'owner' }),
        count: vi.fn().mockResolvedValue(1),
        upsert: vi.fn(),
      },
    };
    await expect(svc(prisma).setMembership('u', 't', 'member')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.teamMember.upsert).not.toHaveBeenCalled();
  });

  it('removes a membership and refuses last-owner removal', async () => {
    const del = vi.fn().mockResolvedValue({});
    const prismaOk = {
      teamMember: {
        findUnique: vi.fn().mockResolvedValue({ role: 'member' }),
        delete: del,
      },
    };
    await svc(prismaOk).removeMembership('u', 't');
    expect(del).toHaveBeenCalled();

    const prismaLast = {
      teamMember: {
        findUnique: vi.fn().mockResolvedValue({ role: 'owner' }),
        count: vi.fn().mockResolvedValue(1),
        delete: vi.fn(),
      },
    };
    await expect(svc(prismaLast).removeMembership('u', 't')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaLast.teamMember.delete).not.toHaveBeenCalled();
  });
});

describe('AdminService createUser', () => {
  it('rejects duplicate email', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'existing' }) },
      $transaction: vi.fn(),
    };
    await expect(
      svc(prisma).createUser({
        email: 'a@b.c',
        name: 'A',
        password: 'longenough',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a user with hashed password and memberships', async () => {
    const created: any[] = [];
    const tx = {
      user: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          created.push(data);
          return { id: 'u', email: data.email, name: data.name, isSuperAdmin: !!data.isSuperAdmin };
        }),
      },
      teamMember: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn().mockImplementation(async (fn: any) => fn(tx)),
    };
    await svc(prisma).createUser({
      email: 'a@b.c',
      name: 'A',
      password: 'longenough',
      memberships: [{ teamId: 't1', role: 'team_admin' }],
    });
    expect(created[0].passwordHash).toBeTruthy();
    expect(created[0].passwordHash).not.toEqual('longenough');
    await expect(bcrypt.compare('longenough', created[0].passwordHash)).resolves.toBe(true);
    expect(tx.teamMember.create).toHaveBeenCalledWith({
      data: { userId: 'u', teamId: 't1', role: 'team_admin' },
    });
  });
});
