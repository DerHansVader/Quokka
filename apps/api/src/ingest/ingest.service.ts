import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { EventBus } from '../common/event-bus';
import { generateRunName } from '../common/run-names';
import { CreateRunDto, LogBatchDto, UpdateRunDto } from './ingest.dto';

@Injectable()
export class IngestService {
  private storagePath: string;

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBus,
  ) {
    this.storagePath = process.env.STORAGE_PATH || './storage';
  }

  async createRun(userId: string, dto: CreateRunDto) {
    return this.prisma.run.create({
      data: {
        projectId: dto.projectId,
        createdByUserId: userId,
        name: dto.name || generateRunName(),
        displayName: dto.displayName,
        config: dto.config || {},
      },
    });
  }

  async logBatch(runId: string, dto: LogBatchDto) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('Run not found');

    const now = new Date().toISOString();
    if (dto.points.length > 0) {
      const params: any[] = [];
      const tuples = dto.points
        .map((p) => {
          const base = params.length;
          params.push(runId, p.key, p.step, p.value, p.wallTime || now);
          return `($${base + 1}::uuid, $${base + 2}, $${base + 3}::bigint, $${base + 4}::double precision, $${base + 5}::timestamptz)`;
        })
        .join(',');
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO metric (run_id, key, step, value, wall_time) VALUES ${tuples}`,
        ...params,
      );
    }

    await this.prisma.run.update({
      where: { id: runId },
      data: {
        heartbeatAt: new Date(),
        ...(run.status === 'crashed' && !run.finishedAt
          ? { status: 'running' }
          : {}),
      },
    });

    const event = {
      runId,
      points: dto.points.map((p) => ({
        key: p.key,
        step: p.step,
        value: p.value,
        wallTime: p.wallTime || now,
      })),
    };
    this.eventBus.emitMetrics(event);

    return { inserted: dto.points.length };
  }

  async heartbeat(runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      select: { status: true, finishedAt: true },
    });
    if (!run) return;
    await this.prisma.run.update({
      where: { id: runId },
      data: {
        heartbeatAt: new Date(),
        ...(run.status === 'crashed' && !run.finishedAt
          ? { status: 'running' }
          : {}),
      },
    });
  }

  async finish(runId: string, summary?: Record<string, any>) {
    await this.prisma.run.update({
      where: { id: runId },
      data: {
        status: 'finished',
        finishedAt: new Date(),
        ...(summary ? { summary } : {}),
      },
    });
  }

  async updateRun(runId: string, dto: UpdateRunDto) {
    return this.prisma.run.update({
      where: { id: runId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
      },
    });
  }

  async uploadSample(
    runId: string,
    step: number,
    key: string,
    gt: string | undefined,
    pred: string | undefined,
    file?: Express.Multer.File,
  ) {
    let imagePath: string | undefined;
    if (file) {
      const dir = path.join(this.storagePath, 'samples', runId);
      await fs.mkdir(dir, { recursive: true });
      const filename = `${key.replace(/\//g, '_')}_${step}${path.extname(file.originalname)}`;
      imagePath = path.join(dir, filename);
      await fs.writeFile(imagePath, file.buffer);
    }

    const sample = await this.prisma.sample.create({
      data: { runId, step, key, gt, pred, imagePath },
    });

    this.eventBus.emitSample({ runId, sampleId: sample.id, step: Number(step), key });
    return sample;
  }
}
