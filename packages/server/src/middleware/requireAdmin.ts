import { createMiddleware } from 'hono/factory';
import type { Actor } from '../types/actor.js';

export const requireAdmin = createMiddleware<{ Variables: { actor: Actor } }>(
  async (c, next) => {
    const actor = c.get('actor');
    if (actor.type !== 'member' || actor.accountRole !== 'admin') {
      return c.json({ error: 'Admin only' }, 403);
    }
    await next();
  },
);
