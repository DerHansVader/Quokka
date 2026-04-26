import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { CreateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private teamsService: TeamsService,
  ) {}

  async listForTeam(teamSlug: string, userId: string) {
    const team = await this.teamsService.getBySlug(teamSlug, userId);
    return this.prisma.project.findMany({
      where: { teamId: team.id },
      include: { _count: { select: { runs: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(teamSlug: string, userId: string, dto: CreateProjectDto) {
    const team = await this.teamsService.getBySlug(teamSlug, userId);
    return this.prisma.project.create({
      data: { teamId: team.id, name: dto.name, slug: dto.slug },
    });
  }

  async getBySlug(teamSlug: string, projectSlug: string, userId: string) {
    const team = await this.teamsService.getBySlug(teamSlug, userId);
    const project = await this.prisma.project.findUnique({
      where: { teamId_slug: { teamId: team.id, slug: projectSlug } },
      include: { _count: { select: { runs: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async getById(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { team: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
