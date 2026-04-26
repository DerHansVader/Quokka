import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface MetricEvent {
  runId: string;
  points: Array<{ key: string; step: number; value: number; wallTime: string }>;
}

export interface SampleEvent {
  runId: string;
  sampleId: string;
  step: number;
  key: string;
}

@Injectable()
export class EventBus {
  private metricSubjects = new Map<string, Subject<MetricEvent>>();
  private sampleSubjects = new Map<string, Subject<SampleEvent>>();

  emitMetrics(event: MetricEvent) {
    this.getMetricSubject(event.runId).next(event);
  }

  emitSample(event: SampleEvent) {
    this.getSampleSubject(event.runId).next(event);
  }

  subscribeMetrics(runId: string) {
    return this.getMetricSubject(runId).asObservable();
  }

  subscribeSamples(runId: string) {
    return this.getSampleSubject(runId).asObservable();
  }

  private getMetricSubject(runId: string) {
    if (!this.metricSubjects.has(runId)) {
      this.metricSubjects.set(runId, new Subject());
    }
    return this.metricSubjects.get(runId)!;
  }

  private getSampleSubject(runId: string) {
    if (!this.sampleSubjects.has(runId)) {
      this.sampleSubjects.set(runId, new Subject());
    }
    return this.sampleSubjects.get(runId)!;
  }
}
