import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { MetricsService } from './metrics.service';

@UseGuards(CombinedAuthGuard)
@Controller()
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Get('runs/:id/keys')
  getKeys(@Param('id') id: string) {
    return this.metricsService.getKeys(id);
  }

  @Get('projects/:projectId/keys')
  getProjectKeys(@Param('projectId') projectId: string) {
    return this.metricsService.getProjectKeys(projectId);
  }

  @Get('runs/:id/series')
  getSeries(
    @Param('id') id: string,
    @Query('keys') keys: string,
    @Query('maxPoints') maxPoints?: string,
  ) {
    return this.metricsService.getSeries(
      id,
      keys.split(','),
      maxPoints ? parseInt(maxPoints, 10) : undefined,
    );
  }

  @Get('compare')
  getCompare(
    @Query('runs') runs: string,
    @Query('keys') keys: string,
    @Query('maxPoints') maxPoints?: string,
  ) {
    return this.metricsService.getCompareSeries(
      runs.split(','),
      keys.split(','),
      maxPoints ? parseInt(maxPoints, 10) : undefined,
    );
  }
}
