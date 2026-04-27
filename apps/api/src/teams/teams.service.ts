import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto, InviteMemberDto, TeamRole } from './teams.dto';

// Minimal user shape we need for authorization. Always pass the full
// authenticated user so we can short-circuit on isSuperAdmin without an
// extra DB round-trip.
export interface ActorUser {
  id: string;
  isSuperAdmin?: boolean;
}

const MANAGE_ROLES: TeamRole[] = ['owner', 'team_admin'];

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async listForUser(user: ActorUser) {
    // Super admins see every team in the instance.
    const where = user.isSuperAdmin ? {} : { members: { some: { userId: user.id } } };
    return this.prisma.team.findMany({
      where,
      include: { _count: { select: { projects: true, members: true } } },
    });
  }

  async create(user: ActorUser, dto: CreateTeamDto) {
    const team = await this.prisma.team.create({ data: dto });
    await this.prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id, role: 'owner' },
    });
    return team;
  }

  async getBySlug(slug: string, user: ActorUser) {
    const team = await this.prisma.team.findUnique({
      where: { slug },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    const me = await this.findMembership(team.id, user);
    return { ...team, myRole: (me?.role as TeamRole) ?? null };
  }

  async inviteMember(teamId: string, user: ActorUser, dto: InviteMemberDto) {
    await this.requireManager(teamId, user);
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

  async joinByInviteKey(user: ActorUser, inviteKey: string) {
    const token = inviteKey.trim();
    if (!token) throw new BadRequestException('Invite key required');

    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invite key');
    }

    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId: user.id } },
    });
    if (existing) {
      await this.prisma.invite.delete({ where: { id: invite.id } });
      return existing;
    }

    const membership = await this.prisma.teamMember.create({
      data: { teamId: invite.teamId, userId: user.id, role: invite.role },
    });
    await this.prisma.invite.delete({ where: { id: invite.id } });
    return membership;
  }

  async listInvites(teamId: string, user: ActorUser) {
    await this.requireManager(teamId, user);
    return this.prisma.invite.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvite(teamId: string, user: ActorUser, inviteId: string) {
    await this.requireManager(teamId, user);
    await this.prisma.invite.deleteMany({ where: { id: inviteId, teamId } });
  }

  async updateMemberRole(
    teamId: string,
    user: ActorUser,
    targetUserId: string,
    role: TeamRole,
  ) {
    const actor = await this.requireManager(teamId, user);
    const target = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');

    // only an owner (or a super admin) can grant or revoke the owner role
    if ((target.role === 'owner' || role === 'owner') && actor !== 'super' && actor.role !== 'owner') {
      throw new ForbiddenException('Only an owner can change owner roles');
    }

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

  async removeMember(teamId: string, user: ActorUser, targetUserId: string) {
    const actor = await this.requireManager(teamId, user);
    const target = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');

    if (target.role === 'owner') {
      if (actor !== 'super' && actor.role !== 'owner') {
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

  // ---------- authorization helpers ----------

  /** Find membership; super admins are allowed without one. */
  async requireMembership(teamId: string, user: ActorUser) {
    if (user.isSuperAdmin) return null;
    const m = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });
    if (!m) throw new ForbiddenException('Not a team member');
    return m;
  }

  /**
   * Returns the membership row, or the literal 'super' for super admins
   * so callers can short-circuit role-specific rules.
   */
  async requireManager(teamId: string, user: ActorUser) {
    if (user.isSuperAdmin) return 'super' as const;
    const m = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });
    if (!m) throw new ForbiddenException('Not a team member');
    if (!MANAGE_ROLES.includes(m.role as TeamRole)) {
      throw new ForbiddenException('Insufficient role');
    }
    return m;
  }

  private async findMembership(teamId: string, user: ActorUser) {
    return this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });
  }
}
