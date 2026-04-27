import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  private jwtGuard = new (AuthGuard('jwt'))();

  constructor(private authService: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const queryToken = typeof req.query?.token === 'string' ? req.query.token : '';
    const auth = req.headers.authorization || (queryToken ? `Bearer ${queryToken}` : '');

    // Accept legacy wt_ keys so existing installations survive the Quokka rename.
    if (auth.startsWith('Bearer qk_') || auth.startsWith('Bearer wt_')) {
      const token = auth.slice(7);
      req.user = await this.authService.validateApiKey(token);
      return true;
    }

    if (queryToken) req.headers.authorization = auth;
    return this.jwtGuard.canActivate(ctx) as Promise<boolean>;
  }
}
