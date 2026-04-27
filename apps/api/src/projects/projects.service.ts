import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActorUser, TeamsService } from '../teams/teams.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';

const MANAGER_ROLES = new Set(['owner', 'team_admin']);

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private teamsService: TeamsService,
  ) {}

  async listForTeam(teamSlug: string, user: ActorUser) {
    const team = await this.teamsService.getBySlug(teamSlug, user);
    const isManager =
      !!user.isSuperAdmin || (team.myRole && MANAGER_ROLES.has(team.myRole));

    const projects = await this.prisma.project.findMany({
      where: { teamId: team.id },
      include: {
        _count: { select: { runs: true } },
        access: { select: { userId: true } },
        pins: { where: { userId: user.id }, select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Hide private projects the user has no explicit access to.
    // Managers (super admin / team owner / team admin) always see everything.
    const visible = projects.filter((p) => {
      if (isManager) return true;
      if (p.visibility !== 'private') return true;
      return p.access.some((a) => a.userId === user.id);
    });

    return visible.map((p) => ({
      ...p,
      pinned: p.pins.length > 0,
      accessUserIds: p.access.map((a) => a.userId),
      access: undefined,
      pins: undefined,
    }));
  }

  async create(teamSlug: string, user: ActorUser, dto: CreateProjectDto) {
    const team = await this.teamsService.getBySlug(teamSlug, user);
    // Anyone in the team can create a project. The creator is always added
    // to the access list when the project is private, so they don't lose
    // access to their own project.
    const visibility = dto.visibility || 'team';
    const accessIds =
      visibility === 'private'
        ? Array.from(new Set([...(dto.accessUserIds || []), user.id]))
        : [];

    return this.prisma.project.create({
      data: {
        teamId: team.id,
        name: dto.name,
        slug: dto.slug,
        visibility,
        access: accessIds.length
          ? { create: accessIds.map((userId) => ({ userId })) }
          : undefined,
      },
    });
  }

  async getBySlug(teamSlug: string, projectSlug: string, user: ActorUser) {
    const team = await this.teamsService.getBySlug(teamSlug, user);
    const project = await this.prisma.project.findUnique({
      where: { teamId_slug: { teamId: team.id, slug: projectSlug } },
      include: {
        _count: { select: { runs: true } },
        access: {
          select: {
            userId: true,
            user: { select: { id: true, email: true, name: true } },
          },
        },
        pins: { where: { userId: user.id }, select: { id: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    this.assertCanRead(project, team.myRole, user);
    const pinned = project.pins.length > 0;
    return {
      ...project,
      pinned,
      access: project.access.map((a) => a.user),
      pins: undefined,
    };
  }

  async getById(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { team: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(
    teamSlug: string,
    projectSlug: string,
    user: ActorUser,
    dto: UpdateProjectDto,
  ) {
    const project = await this.requireManagedProject(teamSlug, projectSlug, user);
    return this.prisma.project.update({
      where: { id: project.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
      },
    });
  }

  async grantAccess(
    teamSlug: string,
    projectSlug: string,
    user: ActorUser,
    targetUserId: string,
  ) {
    const project = await this.requireManagedProject(teamSlug, projectSlug, user);
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: project.teamId, userId: targetUserId } },
    });
    if (!member) {
      throw new BadRequestException('User must be a team member first');
    }
    return this.prisma.projectAccess.upsert({
      where: { projectId_userId: { projectId: project.id, userId: targetUserId } },
      update: {},
      create: { projectId: project.id, userId: targetUserId },
    });
  }

  async revokeAccess(
    teamSlug: string,
    projectSlug: string,
    user: ActorUser,
    targetUserId: string,
  ) {
    const project = await this.requireManagedProject(teamSlug, projectSlug, user);
    await this.prisma.projectAccess.deleteMany({
      where: { projectId: project.id, userId: targetUserId },
    });
  }

  async pin(teamSlug: string, projectSlug: string, user: ActorUser) {
    const project = await this.getBySlug(teamSlug, projectSlug, user);
    await this.prisma.projectPin.upsert({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
      update: {},
      create: { userId: user.id, projectId: project.id },
    });
    return { pinned: true };
  }

  async unpin(teamSlug: string, projectSlug: string, user: ActorUser) {
    const project = await this.getBySlug(teamSlug, projectSlug, user);
    await this.prisma.projectPin.deleteMany({
      where: { userId: user.id, projectId: project.id },
    });
    return { pinned: false };
  }

  // ---------- helpers ----------

  private assertCanRead(
    project: { visibility: string; access: { userId: string }[] },
    myRole: string | null | undefined,
    user: ActorUser,
  ) {
    if (user.isSuperAdmin) return;
    const isManager = !!myRole && MANAGER_ROLES.has(myRole);
    if (isManager) return;
    if (project.visibility !== 'private') return;
    const ok = project.access.some((a) => a.userId === user.id);
    if (!ok) throw new ForbiddenException('No access to this project');
  }

  private async requireManagedProject(
    teamSlug: string,
    projectSlug: string,
    user: ActorUser,
  ) {
    const team = await this.teamsService.getBySlug(teamSlug, user);
    if (
      !user.isSuperAdmin &&
      !(team.myRole && MANAGER_ROLES.has(team.myRole))
    ) {
      throw new ForbiddenException('Only owners or team admins can edit projects');
    }
    const project = await this.prisma.project.findUnique({
      where: { teamId_slug: { teamId: team.id, slug: projectSlug } },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
