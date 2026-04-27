import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TeamRole } from '../teams/teams.dto';
import { CreateUserDto } from './admin.dto';

/**
 * Instance-wide administration. All methods assume the caller has already
 * been authorized as a super admin via SuperAdminGuard.
 */
@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            team: { select: { id: true, slug: true, name: true } },
          },
        },
      },
    });
  }

  async listTeams() {
    return this.prisma.team.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { projects: true, members: true } },
      },
    });
  }

  async setSuperAdmin(actorId: string, targetUserId: string, isSuperAdmin: boolean) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    if (!isSuperAdmin && target.isSuperAdmin) {
      await this.assertNotLastSuperAdmin(targetUserId);
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { isSuperAdmin },
      select: { id: true, email: true, name: true, isSuperAdmin: true },
    });
  }

  async resetPassword(targetUserId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
      select: { id: true },
    });
    return { ok: true, id: updated.id };
  }

  async deleteUser(actorId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.isSuperAdmin) {
      await this.assertNotLastSuperAdmin(targetUserId);
    }
    await this.prisma.user.delete({ where: { id: targetUserId } });
  }

  async deleteTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    await this.prisma.team.delete({ where: { id: teamId } });
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already in use');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
          isSuperAdmin: !!dto.isSuperAdmin,
        },
        select: { id: true, email: true, name: true, isSuperAdmin: true },
      });
      if (dto.memberships?.length) {
        for (const m of dto.memberships) {
          await tx.teamMember.create({
            data: { userId: user.id, teamId: m.teamId, role: m.role || 'member' },
          });
        }
      }
      return user;
    });
  }

  /** Add or update a user's role within a team. */
  async setMembership(targetUserId: string, teamId: string, role: TeamRole) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');
    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (existing && existing.role === 'owner' && role !== 'owner') {
      const owners = await this.prisma.teamMember.count({
        where: { teamId, role: 'owner' },
      });
      if (owners <= 1) {
        throw new BadRequestException('Cannot demote the last owner');
      }
    }
    return this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      update: { role },
      create: { teamId, userId: targetUserId, role },
    });
  }

  async removeMembership(targetUserId: string, teamId: string) {
    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!existing) return;
    if (existing.role === 'owner') {
      const owners = await this.prisma.teamMember.count({
        where: { teamId, role: 'owner' },
      });
      if (owners <= 1) {
        throw new BadRequestException('Cannot remove the last owner');
      }
    }
    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
  }

  /** Refuse changes that would leave the instance with no super admin. */
  private async assertNotLastSuperAdmin(userId: string) {
    const others = await this.prisma.user.count({
      where: { isSuperAdmin: true, NOT: { id: userId } },
    });
    if (others === 0) {
      throw new BadRequestException(
        'Cannot remove the last super admin — promote another user first',
      );
    }
  }
}
