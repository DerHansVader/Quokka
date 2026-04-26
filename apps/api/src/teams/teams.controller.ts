import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TeamsService } from './teams.service';
import { CreateTeamDto, InviteMemberDto, UpdateRoleDto } from './teams.dto';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(AuthGuard('jwt'))
@Controller('teams')
export class TeamsController {
  constructor(
    private teamsService: TeamsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.teamsService.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(user.id, dto);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string, @CurrentUser() user: any) {
    return this.teamsService.getBySlug(slug, user.id);
  }

  @Post(':slug/invites')
  async invite(
    @Param('slug') slug: string,
    @CurrentUser() user: any,
    @Body() dto: InviteMemberDto,
  ) {
    const teamId = await this.resolveTeamId(slug);
    return this.teamsService.inviteMember(teamId, user.id, dto);
  }

  @Get(':slug/invites')
  async listInvites(@Param('slug') slug: string, @CurrentUser() user: any) {
    const teamId = await this.resolveTeamId(slug);
    return this.teamsService.listInvites(teamId, user.id);
  }

  @Delete(':slug/invites/:inviteId')
  async revokeInvite(
    @Param('slug') slug: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: any,
  ) {
    const teamId = await this.resolveTeamId(slug);
    return this.teamsService.revokeInvite(teamId, user.id, inviteId);
  }

  @Patch(':slug/members/:userId')
  async updateMemberRole(
    @Param('slug') slug: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateRoleDto,
  ) {
    const teamId = await this.resolveTeamId(slug);
    return this.teamsService.updateMemberRole(teamId, user.id, targetUserId, dto.role);
  }

  @Delete(':slug/members/:userId')
  async removeMember(
    @Param('slug') slug: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: any,
  ) {
    const teamId = await this.resolveTeamId(slug);
    return this.teamsService.removeMember(teamId, user.id, targetUserId);
  }

  private async resolveTeamId(slug: string): Promise<string> {
    const team = await this.prisma.team.findUnique({ where: { slug } });
    if (!team) throw new NotFoundException('Team not found');
    return team.id;
  }
}
