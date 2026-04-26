import { Module } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { IngestController } from './ingest.controller';
import { AuthModule } from '../auth/auth.module';
import { EventBus } from '../common/event-bus';

@Module({
  imports: [AuthModule],
  controllers: [IngestController],
  providers: [IngestService, EventBus],
  exports: [EventBus],
})
export class IngestModule {}
