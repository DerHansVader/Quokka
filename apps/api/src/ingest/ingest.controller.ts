import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { IngestService } from './ingest.service';
import { CreateRunDto, LogBatchDto, UpdateRunDto } from './ingest.dto';

@UseGuards(CombinedAuthGuard)
@Controller('runs')
export class IngestController {
  constructor(
    private ingestService: IngestService,
    private prisma: PrismaService,
  ) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateRunDto) {
    return this.ingestService.createRun(user.id, dto);
  }

  @Post('ensure-project')
  async ensureProject(
    @CurrentUser() user: any,
    @Body() body: { project: string; team?: string },
  ) {
    const slug = body.project.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

    let team;
    if (body.team) {
      team = await this.prisma.team.findUnique({ where: { slug: body.team } });
      if (!team) throw new NotFoundException(`Team '${body.team}' not found`);
    } else {
      const membership = await this.prisma.teamMember.findFirst({
        where: { userId: user.id },
        include: { team: true },
        orderBy: { team: { slug: 'asc' } },
      });
      if (!membership) throw new NotFoundException('User has no team');
      team = membership.team;
    }

    const existing = await this.prisma.project.findUnique({
      where: { teamId_slug: { teamId: team.id, slug } },
    });
    if (existing) {
      return { id: existing.id, teamSlug: team.slug, projectSlug: slug, created: false };
    }

    const created = await this.prisma.project.create({
      data: { teamId: team.id, slug, name: body.project },
    });
    return { id: created.id, teamSlug: team.slug, projectSlug: slug, created: true };
  }

  @Post(':id/log')
  log(@Param('id') id: string, @Body() dto: LogBatchDto) {
    return this.ingestService.logBatch(id, dto);
  }

  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string) {
    return this.ingestService.heartbeat(id);
  }

  @Post(':id/finish')
  finish(@Param('id') id: string, @Body() body: { summary?: Record<string, any> }) {
    return this.ingestService.finish(id, body.summary);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRunDto) {
    return this.ingestService.updateRun(id, dto);
  }

  @Post(':id/samples')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadSample(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { step: string; key: string; gt?: string; pred?: string },
  ) {
    return this.ingestService.uploadSample(
      id,
      parseInt(body.step, 10),
      body.key,
      body.gt,
      body.pred,
      file,
    );
  }
}
