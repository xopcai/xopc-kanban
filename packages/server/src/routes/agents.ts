import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { assertAccountCanWrite } from '../lib/accountAcl.js';
import { HttpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import { createAgentWithCredential, listAgents } from '../services/AuthService.js';
import type { Actor } from '../types/actor.js';

const createBody = z.object({
  name: z.string().min(1).max(120),
});

export const agentsRouter = new Hono<{ Variables: { actor: Actor } }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    if (c.get('actor').type !== 'member') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return c.json(await listAgents());
  })
  .post('/', zValidator('json', createBody), async (c) => {
    const actor = c.get('actor');
    if (actor.type !== 'member') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    try {
      assertAccountCanWrite(actor);
    } catch (e) {
      if (e instanceof HttpError) return c.json({ error: e.message }, e.status as 403);
      throw e;
    }
    const body = c.req.valid('json');
    const out = await createAgentWithCredential({
      name: body.name,
      createdByMemberId: actor.id,
    });
    return c.json(out, 201);
  });
