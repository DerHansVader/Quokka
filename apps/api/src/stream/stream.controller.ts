import { Controller, Get, Param, Sse, UseGuards } from '@nestjs/common';
import { Observable, map, merge } from 'rxjs';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { EventBus } from '../common/event-bus';

@UseGuards(CombinedAuthGuard)
@Controller('runs')
export class StreamController {
  constructor(private eventBus: EventBus) {}

  @Sse(':id/stream')
  stream(@Param('id') runId: string): Observable<MessageEvent> {
    const metrics$ = this.eventBus.subscribeMetrics(runId).pipe(
      map((event) => ({ data: { type: 'metrics', ...event } }) as unknown as MessageEvent),
    );
    const samples$ = this.eventBus.subscribeSamples(runId).pipe(
      map((event) => ({ data: { type: 'sample', ...event } }) as unknown as MessageEvent),
    );
    return merge(metrics$, samples$);
  }
}
