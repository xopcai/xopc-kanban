import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { TaskEvent } from '../types';
import { taskKeys } from './useTasks';

export function useTaskEventsStream(enabled = true) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const es = new EventSource('/api/events');

    const onMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data as string) as TaskEvent;
        void qc.invalidateQueries({ queryKey: taskKeys.all });
        if (data.taskId) {
          void qc.invalidateQueries({ queryKey: taskKeys.detail(data.taskId) });
          void qc.invalidateQueries({ queryKey: taskKeys.memory(data.taskId) });
        }
      } catch {
        /* ignore */
      }
    };

    es.addEventListener('message', onMessage);
    es.onerror = () => {
      es.close();
    };

    return () => {
      es.removeEventListener('message', onMessage);
      es.close();
    };
  }, [enabled, qc]);
}
