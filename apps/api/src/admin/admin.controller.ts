import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ResetPasswordDto, UpdateSuperAdminDto } from './admin.dto';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { CurrentUser } from '../common/current-user.decorator';

@UseGuards(SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }

  @Get('teams')
  listTeams() {
    return this.admin.listTeams();
  }

  @Patch('users/:id')
  setSuperAdmin(
    @CurrentUser() actor: any,
    @Param('id') id: string,
    @Body() dto: UpdateSuperAdminDto,
  ) {
    return this.admin.setSuperAdmin(actor.id, id, dto.isSuperAdmin);
  }

  @Post('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.admin.resetPassword(id, dto.newPassword);
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() actor: any, @Param('id') id: string) {
    return this.admin.deleteUser(actor.id, id);
  }

  @Delete('teams/:id')
  deleteTeam(@Param('id') id: string) {
    return this.admin.deleteTeam(id);
  }
}
