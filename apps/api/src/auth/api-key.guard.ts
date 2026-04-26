import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    // Accept legacy wt_ keys so existing installations survive the Quokka rename.
    if (!auth?.startsWith('Bearer qk_') && !auth?.startsWith('Bearer wt_')) return false;
    const token = auth.slice(7);
    try {
      req.user = await this.authService.validateApiKey(token);
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
