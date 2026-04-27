import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('fails startup loudly when the metric hypertable is missing', async () => {
    const prisma = new PrismaService();
    vi.spyOn(prisma, '$connect').mockResolvedValue(undefined);
    vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([{ exists: false }] as any);
    vi.spyOn(prisma, '$disconnect').mockResolvedValue(undefined);

    await expect(prisma.onModuleInit()).rejects.toThrow('Missing metric hypertable');

    await prisma.$disconnect();
  });

  it('allows startup when the metric hypertable exists', async () => {
    const prisma = new PrismaService();
    vi.spyOn(prisma, '$connect').mockResolvedValue(undefined);
    vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([{ exists: true }] as any);
    vi.spyOn(prisma, '$disconnect').mockResolvedValue(undefined);

    await expect(prisma.onModuleInit()).resolves.toBeUndefined();

    await prisma.$disconnect();
  });
});
