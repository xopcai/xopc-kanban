import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { requireAuth } from '../middleware/auth.js';
import { eventBus } from '../services/EventBus.js';
import type { Actor } from '../types/actor.js';
import type { TaskEvent } from '../types/index.js';

export const eventsRouter = new Hono<{ Variables: { actor: Actor } }>()
  .use('*', requireAuth)
  .get('/', (c) =>
    streamSSE(c, async (stream) => {
      const listener = async (ev: TaskEvent) => {
        await stream.writeSSE({ data: JSON.stringify(ev) });
      };
      const unsub = eventBus.subscribeAll(listener);
      const onAbort = () => unsub();
      c.req.raw.signal.addEventListener('abort', onAbort, { once: true });
      try {
        while (true) {
          await stream.sleep(25_000);
        }
      } finally {
        onAbort();
      }
    }),
  )
  .get('/:taskId', (c) =>
    streamSSE(c, async (stream) => {
      const taskId = c.req.param('taskId');
      const listener = async (ev: TaskEvent) => {
        await stream.writeSSE({ data: JSON.stringify(ev) });
      };
      const unsub = eventBus.subscribeTask(taskId, listener);
      const onAbort = () => unsub();
      c.req.raw.signal.addEventListener('abort', onAbort, { once: true });
      try {
        while (true) {
          await stream.sleep(25_000);
        }
      } finally {
        onAbort();
      }
    }),
  );
