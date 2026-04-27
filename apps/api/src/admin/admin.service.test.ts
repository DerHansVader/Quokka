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
