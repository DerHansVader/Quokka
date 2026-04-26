import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { lttb } from './lttb';

interface RawMetric {
  run_id: string;
  key: string;
  step: bigint;
  value: number;
  wall_time: Date;
}

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  async getKeys(runId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ key: string }>>(
      `SELECT DISTINCT key FROM metric WHERE run_id = $1::uuid ORDER BY key`,
      runId,
    );
    return rows.map((r) => r.key);
  }

  async getProjectKeys(projectId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ key: string }>>(
      `SELECT DISTINCT m.key FROM metric m
       JOIN "Run" r ON r.id = m.run_id
       WHERE r."projectId" = $1::uuid AND r.archived = false
       ORDER BY m.key`,
      projectId,
    );
    return rows.map((r) => r.key);
  }

  async getSeries(runId: string, keys: string[], maxPoints = 2000) {
    const result: Record<string, Array<{ step: number; value: number; wallTime: string }>> = {};

    for (const key of keys) {
      const rows = await this.prisma.$queryRawUnsafe<RawMetric[]>(
        `SELECT step, value, wall_time FROM metric WHERE run_id = $1::uuid AND key = $2 ORDER BY step`,
        runId,
        key,
      );

      const points = rows.map((r) => ({
        step: Number(r.step),
        value: r.value,
        wallTime: r.wall_time.toISOString(),
      }));

      result[key] = lttb(points, maxPoints);
    }

    return result;
  }

  async getCompareSeries(runIds: string[], keys: string[], maxPoints = 2000) {
    const result: Record<string, Record<string, Array<{ step: number; value: number; wallTime: string }>>> = {};

    for (const key of keys) {
      result[key] = {};
      for (const runId of runIds) {
        const rows = await this.prisma.$queryRawUnsafe<RawMetric[]>(
          `SELECT step, value, wall_time FROM metric WHERE run_id = $1::uuid AND key = $2 ORDER BY step`,
          runId,
          key,
        );

        const points = rows.map((r) => ({
          step: Number(r.step),
          value: r.value,
          wallTime: r.wall_time.toISOString(),
        }));

        result[key][runId] = lttb(points, maxPoints);
      }
    }

    return result;
  }
}
