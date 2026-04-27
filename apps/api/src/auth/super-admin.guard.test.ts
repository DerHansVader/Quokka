import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SuperAdminGuard } from './super-admin.guard';

function ctx(user: any) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('SuperAdminGuard', () => {
  it('allows super admins through', async () => {
    const guard = new SuperAdminGuard();
    vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate' as any)
      .mockResolvedValue(true);

    await expect(guard.canActivate(ctx({ id: 'u', isSuperAdmin: true }))).resolves.toBe(true);
  });

  it('rejects authenticated non-super users', async () => {
    const guard = new SuperAdminGuard();
    vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate' as any)
      .mockResolvedValue(true);

    await expect(
      guard.canActivate(ctx({ id: 'u', isSuperAdmin: false })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks unauthenticated requests early', async () => {
    const guard = new SuperAdminGuard();
    vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate' as any)
      .mockResolvedValue(false);

    await expect(guard.canActivate(ctx(undefined))).resolves.toBe(false);
  });
});
