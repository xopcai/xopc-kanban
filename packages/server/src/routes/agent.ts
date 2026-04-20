import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import type { Actor } from '../types/actor.js';

/** Phase 3 — Agent API 占位，避免客户端 404 */
export const agentRouter = new Hono<{ Variables: { actor: Actor } }>()
  .use('*', requireAuth)
  .all('/*', (c) =>
    c.json(
      {
        error: 'Agent API not implemented',
        path: c.req.path,
      },
      501,
    ),
  );
