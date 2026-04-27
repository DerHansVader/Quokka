import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, CreateApiKeyDto, ChangePasswordDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Request() req: any) {
    const { passwordHash, ...user } = req.user;
    return user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('password')
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('api-keys')
  createApiKey(@Request() req: any, @Body() dto: CreateApiKeyDto) {
    return this.authService.createApiKey(req.user.id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('api-keys')
  listApiKeys(@Request() req: any) {
    return this.authService.listApiKeys(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('api-keys/:id')
  revokeApiKey(@Request() req: any, @Param('id') id: string) {
    return this.authService.revokeApiKey(req.user.id, id);
  }
}
