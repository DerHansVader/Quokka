import { describe, expect, it, vi } from 'vitest';
import { IngestService } from './ingest.service';

function createService(run: { status: string; finishedAt: Date | null }) {
  const prisma = {
    run: {
      findUnique: vi.fn().mockResolvedValue(run),
      update: vi.fn().mockResolvedValue({}),
    },
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
  };
  const eventBus = {
    emitMetrics: vi.fn(),
    emitSample: vi.fn(),
  };

  return {
    service: new IngestService(prisma as any, eventBus as any),
    prisma,
    eventBus,
  };
}

describe('IngestService', () => {
  it('revives crashed unfinished runs on heartbeat', async () => {
    const { service, prisma } = createService({ status: 'crashed', finishedAt: null });

    await service.heartbeat('run-1');

    expect(prisma.run.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'running' }),
    });
  });

  it('does not revive finished runs on heartbeat', async () => {
    const { service, prisma } = createService({ status: 'crashed', finishedAt: new Date() });

    await service.heartbeat('run-1');

    expect(prisma.run.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.not.objectContaining({ status: 'running' }),
    });
  });

  it('treats successful metric ingest as proof of life', async () => {
    const { service, prisma, eventBus } = createService({ status: 'crashed', finishedAt: null });

    await service.logBatch('run-1', {
      points: [{ key: 'loss', step: 1, value: 0.5 }],
    });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
    expect(prisma.run.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'running' }),
    });
    expect(eventBus.emitMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        points: [expect.objectContaining({ key: 'loss', step: 1, value: 0.5 })],
      }),
    );
  });
});
