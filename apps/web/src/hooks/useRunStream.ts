import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface SSEPoint {
  key: string;
  step: number;
  value: number;
  wallTime: string;
}

export function useRunStream(runId: string | undefined) {
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!runId) return;
    const token = localStorage.getItem('qk_token');
    const url = `/api/runs/${runId}/stream${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'metrics') {
          qc.invalidateQueries({ queryKey: ['series', runId] });
        }
        if (msg.type === 'sample') {
          qc.invalidateQueries({ queryKey: ['samples', runId] });
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      setTimeout(connect, 3000);
    };

    esRef.current = es;
  }, [runId, qc]);

  useEffect(() => {
    connect();
    return () => esRef.current?.close();
  }, [connect]);
}
