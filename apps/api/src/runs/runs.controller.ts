import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { RunsService } from './runs.service';

@UseGuards(CombinedAuthGuard)
@Controller()
export class RunsController {
  constructor(private runsService: RunsService) {}

  @Get('projects/:projectId/runs')
  list(
    @Param('projectId') projectId: string,
    @Query('archived') archived?: string,
  ) {
    return this.runsService.listForProject(projectId, archived === 'true');
  }

  @Get('runs/:id')
  get(@Param('id') id: string) {
    return this.runsService.getById(id);
  }

  @Patch('runs/:id/archive')
  archive(@Param('id') id: string) {
    return this.runsService.archive(id);
  }

  @Get('runs/:id/samples')
  getSamples(@Param('id') id: string, @Query('key') key?: string) {
    return this.runsService.getSamples(id, key);
  }

  @Get('runs/:id/sample-keys')
  getSampleKeys(@Param('id') id: string) {
    return this.runsService.getSampleKeys(id);
  }
}
