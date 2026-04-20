import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { labelService } from '../services/LabelService.js';

const createBody = z.object({
  name: z.string().min(1),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use hex like #6366f1'),
});

export const labelsRouter = new Hono()
  .get('/', async (c) => {
    const labels = await labelService.list();
    return c.json(labels);
  })
  .post('/', zValidator('json', createBody), async (c) => {
    const body = c.req.valid('json');
    const label = await labelService.create(body);
    return c.json(label, 201);
  });
