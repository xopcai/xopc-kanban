import { Hono } from 'hono';

/** Phase 3 — Agent API 占位，避免客户端 404 */
export const agentRouter = new Hono().all('/*', (c) =>
  c.json(
    {
      error: 'Agent API not implemented',
      path: c.req.path,
    },
    501,
  ),
);
