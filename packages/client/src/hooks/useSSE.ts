import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { TaskEvent } from '../types';
import { useAuthStore } from '../store/authStore';
import { taskKeys } from './useTasks';

export function useTaskEventsStream(enabled = true) {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!enabled || !token) return;

    const url = `/api/events?access_token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

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
  }, [enabled, qc, token]);
}
