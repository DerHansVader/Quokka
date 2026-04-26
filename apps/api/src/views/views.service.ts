import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateViewDto, UpdateViewDto } from './views.dto';

@Injectable()
export class ViewsService {
  constructor(private prisma: PrismaService) {}

  async listForScope(scope: string, scopeId: string) {
    return this.prisma.view.findMany({
      where: { scope, scopeId },
      orderBy: { title: 'asc' },
    });
  }

  async create(dto: CreateViewDto) {
    return this.prisma.view.create({
      data: {
        scope: dto.scope,
        scopeId: dto.scopeId,
        title: dto.title,
        layout: dto.layout || [],
        ...(dto.scope === 'project' ? { projectId: dto.scopeId } : {}),
      },
    });
  }

  async update(id: string, dto: UpdateViewDto) {
    return this.prisma.view.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.layout !== undefined ? { layout: dto.layout } : {}),
      },
    });
  }

  async delete(id: string) {
    await this.prisma.view.delete({ where: { id } });
  }

  async getOrCreateDefault(scope: string, scopeId: string) {
    const existing = await this.prisma.view.findFirst({
      where: { scope, scopeId, title: 'Default' },
    });
    if (existing) return existing;
    return this.create({ scope, scopeId, title: 'Default', layout: [] });
  }
}
