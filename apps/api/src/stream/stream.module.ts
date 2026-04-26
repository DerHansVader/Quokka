import { Module } from '@nestjs/common';
import { StreamController } from './stream.controller';
import { AuthModule } from '../auth/auth.module';
import { IngestModule } from '../ingest/ingest.module';

@Module({
  imports: [AuthModule, IngestModule],
  controllers: [StreamController],
})
export class StreamModule {}
