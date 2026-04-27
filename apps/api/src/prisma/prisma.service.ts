import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await this.assertMetricTableExists();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async assertMetricTableExists() {
    const [row] = await this.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT to_regclass('public.metric') IS NOT NULL AS "exists"`,
    );
    if (!row?.exists) {
      throw new Error(
        'Missing metric hypertable. Do not run `prisma db push`; restore from backup and run `prisma migrate deploy`.',
      );
    }
  }
}
