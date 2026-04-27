import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Pass-through JWT guard that additionally requires the authenticated user
 * to be the instance super admin. One Quokka instance is one company, so
 * the super admin is the company-wide admin who can see and manage every
 * team and user without being a member of any of them.
 */
@Injectable()
export class SuperAdminGuard extends AuthGuard('jwt') implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = await (super.canActivate(ctx) as Promise<boolean>);
    if (!ok) return false;
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.isSuperAdmin) {
      throw new ForbiddenException('Super admin access required');
    }
    return true;
  }
}
