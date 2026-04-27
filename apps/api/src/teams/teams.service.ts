import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto, InviteMemberDto, TeamRole } from './teams.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async listForUser(userId: string) {
    return this.prisma.team.findMany({
      where: { members: { some: { userId } } },
      include: { _count: { select: { projects: true, members: true } } },
    });
  }

  async create(userId: string, dto: CreateTeamDto) {
    const team = await this.prisma.team.create({ data: dto });
    await this.prisma.teamMember.create({
      data: { teamId: team.id, userId, role: 'owner' },
    });
    return team;
  }

  async getBySlug(slug: string, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    const me = await this.requireMembership(team.id, userId);
    return { ...team, myRole: me.role as TeamRole };
  }

  async inviteMember(teamId: string, userId: string, dto: InviteMemberDto) {
    await this.requireRole(teamId, userId, ['owner', 'admin']);
    const token = `qki_${crypto.randomBytes(18).toString('base64url')}`;
    return this.prisma.invite.create({
      data: {
        teamId,
        email: dto.email,
        role: dto.role || 'member',
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async joinByInviteKey(userId: string, inviteKey: string) {
    const token = inviteKey.trim();
    if (!token) throw new BadRequestException('Invite key required');

    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invite key');
    }

    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId } },
    });
    if (existing) {
      await this.prisma.invite.delete({ where: { id: invite.id } });
      return existing;
    }

    const membership = await this.prisma.teamMember.create({
      data: { teamId: invite.teamId, userId, role: invite.role },
    });
    await this.prisma.invite.delete({ where: { id: invite.id } });
    return membership;
  }

  async listInvites(teamId: string, userId: string) {
    await this.requireRole(teamId, userId, ['owner', 'admin']);
    return this.prisma.invite.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvite(teamId: string, userId: string, inviteId: string) {
    await this.requireRole(teamId, userId, ['owner', 'admin']);
    await this.prisma.invite.deleteMany({ where: { id: inviteId, teamId } });
  }

  async updateMemberRole(
    teamId: string,
    userId: string,
    targetUserId: string,
    role: TeamRole,
  ) {
    const actor = await this.requireRole(teamId, userId, ['owner', 'admin']);
    const target = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');

    // only an owner can grant or revoke the owner role
    if ((target.role === 'owner' || role === 'owner') && actor.role !== 'owner') {
      throw new ForbiddenException('Only an owner can change owner roles');
    }

    // never let the last owner be demoted
    if (target.role === 'owner' && role !== 'owner') {
      const owners = await this.prisma.teamMember.count({
        where: { teamId, role: 'owner' },
      });
      if (owners <= 1) {
        throw new BadRequestException('Cannot demote the last owner');
      }
    }

    return this.prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      data: { role },
    });
  }

  async removeMember(teamId: string, userId: string, targetUserId: string) {
    const actor = await this.requireRole(teamId, userId, ['owner', 'admin']);
    const target = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');

    if (target.role === 'owner') {
      if (actor.role !== 'owner') {
        throw new ForbiddenException('Only an owner can remove an owner');
      }
      const owners = await this.prisma.teamMember.count({
        where: { teamId, role: 'owner' },
      });
      if (owners <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }

    await this.prisma.teamMember.deleteMany({
      where: { teamId, userId: targetUserId },
    });
  }

  async requireMembership(teamId: string, userId: string) {
    const m = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!m) throw new ForbiddenException('Not a team member');
    return m;
  }

  async requireRole(teamId: string, userId: string, roles: string[]) {
    const m = await this.requireMembership(teamId, userId);
    if (!roles.includes(m.role)) throw new ForbiddenException('Insufficient role');
    return m;
  }
}
