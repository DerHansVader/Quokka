import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { CombinedAuthGuard } from './combined-auth.guard';

function contextFor(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
}

describe('CombinedAuthGuard', () => {
  it('accepts legacy wt_ API keys after the Quokka rename', async () => {
    const authService = {
      validateApiKey: vi.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const guard = new CombinedAuthGuard(authService as any);
    const req = { headers: { authorization: 'Bearer wt_existing' }, query: {} };

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);

    expect(authService.validateApiKey).toHaveBeenCalledWith('wt_existing');
    expect(req.user).toEqual({ id: 'user-1' });
  });

  it('passes EventSource query tokens to the JWT guard', async () => {
    const guard = new CombinedAuthGuard({ validateApiKey: vi.fn() } as any);
    const jwtGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    };
    (guard as unknown as { jwtGuard: typeof jwtGuard }).jwtGuard = jwtGuard;

    const req = { headers: {}, query: { token: 'jwt-token' } };
    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);

    expect(req.headers.authorization).toBe('Bearer jwt-token');
    expect(jwtGuard.canActivate).toHaveBeenCalled();
  });
});
