import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TeamsModule } from './teams/teams.module';
import { ProjectsModule } from './projects/projects.module';
import { RunsModule } from './runs/runs.module';
import { IngestModule } from './ingest/ingest.module';
import { MetricsModule } from './metrics/metrics.module';
import { StreamModule } from './stream/stream.module';
import { ViewsModule } from './views/views.module';
import { HealthController } from './common/health.controller';
import { RunHealthService } from './common/run-health.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TeamsModule,
    ProjectsModule,
    RunsModule,
    IngestModule,
    MetricsModule,
    StreamModule,
    ViewsModule,
  ],
  controllers: [HealthController],
  providers: [RunHealthService],
})
export class AppModule {}
