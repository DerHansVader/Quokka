import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiKeyGuard } from './api-key.guard';

function contextFor(authorization?: string): ExecutionContext {
  const req = { headers: { authorization } };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  it('accepts new qk_ keys and legacy wt_ keys', async () => {
    const authService = {
      validateApiKey: vi.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const guard = new ApiKeyGuard(authService as any);

    await expect(guard.canActivate(contextFor('Bearer qk_new'))).resolves.toBe(true);
    await expect(guard.canActivate(contextFor('Bearer wt_old'))).resolves.toBe(true);

    expect(authService.validateApiKey).toHaveBeenNthCalledWith(1, 'qk_new');
    expect(authService.validateApiKey).toHaveBeenNthCalledWith(2, 'wt_old');
  });

  it('rejects unrelated bearer tokens before hitting storage', async () => {
    const authService = {
      validateApiKey: vi.fn(),
    };
    const guard = new ApiKeyGuard(authService as any);

    await expect(guard.canActivate(contextFor('Bearer nope'))).resolves.toBe(false);

    expect(authService.validateApiKey).not.toHaveBeenCalled();
  });

  it('turns failed key validation into UnauthorizedException', async () => {
    const guard = new ApiKeyGuard({
      validateApiKey: vi.fn().mockRejectedValue(new Error('bad key')),
    } as any);

    await expect(guard.canActivate(contextFor('Bearer qk_bad'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
