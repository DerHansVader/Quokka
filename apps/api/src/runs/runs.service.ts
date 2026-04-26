import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RunsService {
  constructor(private prisma: PrismaService) {}

  async listForProject(projectId: string, includeArchived = false) {
    return this.prisma.run.findMany({
      where: {
        projectId,
        ...(includeArchived ? {} : { archived: false }),
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getById(runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        project: { include: { team: true } },
      },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  async archive(runId: string) {
    return this.prisma.run.update({
      where: { id: runId },
      data: { archived: true },
    });
  }

  async getSamples(runId: string, key?: string) {
    return this.prisma.sample.findMany({
      where: { runId, ...(key ? { key } : {}) },
      orderBy: { step: 'asc' },
    });
  }

  async getSampleKeys(runId: string) {
    const rows = await this.prisma.sample.findMany({
      where: { runId },
      distinct: ['key'],
      select: { key: true },
    });
    return rows.map((r) => r.key);
  }
}
