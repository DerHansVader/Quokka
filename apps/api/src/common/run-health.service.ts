import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STALE_HEARTBEAT_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

@Injectable()
export class RunHealthService implements OnModuleInit {
  private readonly logger = new Logger(RunHealthService.name);

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    setInterval(() => {
      this.markCrashedRuns().catch((err) =>
        this.logger.warn(`health sweep failed: ${err.message ?? err}`),
      );
    }, CHECK_INTERVAL_MS);
  }

  async markCrashedRuns() {
    const threshold = new Date(Date.now() - STALE_HEARTBEAT_MS);
    const result = await this.prisma.run.updateMany({
      where: { status: 'running', heartbeatAt: { lt: threshold } },
      data: { status: 'crashed' },
    });
    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} stale runs as crashed`);
    }
  }
}
