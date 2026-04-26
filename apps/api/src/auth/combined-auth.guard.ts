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
    const auth = req.headers.authorization || '';

    if (auth.startsWith('Bearer qk_')) {
      const token = auth.slice(7);
      req.user = await this.authService.validateApiKey(token);
      return true;
    }

    return this.jwtGuard.canActivate(ctx) as Promise<boolean>;
  }
}
