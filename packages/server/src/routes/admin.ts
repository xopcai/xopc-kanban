import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  createMemberByAdmin,
  listMembersForAdmin,
} from '../services/AuthService.js';
import type { Actor } from '../types/actor.js';

const createMemberBody = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  password: z.string().min(8).optional(),
  accountRole: z.enum(['member', 'guest']).optional(),
});

export const adminRouter = new Hono<{ Variables: { actor: Actor } }>()
  .use('*', requireAuth)
  .use('*', requireAdmin)
  .get('/members', async (c) => {
    const members = await listMembersForAdmin();
    return c.json({ members });
  })
  .post('/members', zValidator('json', createMemberBody), async (c) => {
    const body = c.req.valid('json');
    try {
      const out = await createMemberByAdmin({
        email: body.email,
        displayName: body.displayName,
        password: body.password,
        accountRole: body.accountRole,
      });
      return c.json(out, 201);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create user';
      if (msg.includes('already')) return c.json({ error: msg }, 409);
      return c.json({ error: msg }, 400);
    }
  });
