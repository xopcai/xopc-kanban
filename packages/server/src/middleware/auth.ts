import { createMiddleware } from 'hono/factory';
import { verifyActorToken } from '../lib/token.js';
import type { Actor } from '../types/actor.js';

function bearerRaw(c: {
  req: {
    header: (n: string) => string | undefined;
    query: (k: string) => string | undefined;
  };
}): string | null {
  const auth = c.req.header('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  const q = c.req.query('access_token');
  if (q) return q.trim();
  return null;
}

/** JWT from `Authorization: Bearer` or `?access_token=` (EventSource cannot set headers). */
export const requireAuth = createMiddleware<{
  Variables: { actor: Actor };
}>(async (c, next) => {
  const raw = bearerRaw(c);
  if (!raw) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    const { sub, typ } = await verifyActorToken(raw);
    c.set('actor', { type: typ, id: sub });
    await next();
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
});
