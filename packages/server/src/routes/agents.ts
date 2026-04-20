import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
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
    const body = c.req.valid('json');
    const out = await createAgentWithCredential({
      name: body.name,
      createdByMemberId: actor.id,
    });
    return c.json(out, 201);
  });
