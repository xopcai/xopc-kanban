import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { HttpError, projectService } from '../services/ProjectService.js';
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
  .get('/:taskId', async (c) => {
    const taskId = c.req.param('taskId');
    const row = await db.select().from(schema.task).where(eq(schema.task.id, taskId)).get();
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (!row.projectId) return c.json({ error: 'Forbidden' }, 403);
    try {
      await projectService.assertMember(c.get('actor'), row.projectId);
    } catch (e) {
      if (e instanceof HttpError && e.status === 403) {
        return c.json({ error: e.message }, 403);
      }
      throw e;
    }
    return streamSSE(c, async (stream) => {
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
    });
  });
