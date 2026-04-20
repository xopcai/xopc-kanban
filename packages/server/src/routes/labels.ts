import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { assertAccountCanWrite } from '../lib/accountAcl.js';
import { HttpError } from '../lib/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import { labelService } from '../services/LabelService.js';
import type { Actor } from '../types/actor.js';

const createBody = z.object({
  name: z.string().min(1),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use hex like #6366f1'),
});

export const labelsRouter = new Hono<{ Variables: { actor: Actor } }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    const labels = await labelService.list();
    return c.json(labels);
  })
  .post('/', zValidator('json', createBody), async (c) => {
    try {
      assertAccountCanWrite(c.get('actor'));
    } catch (e) {
      if (e instanceof HttpError) return c.json({ error: e.message }, e.status as 403);
      throw e;
    }
    const body = c.req.valid('json');
    const label = await labelService.create(body);
    return c.json(label, 201);
  });
