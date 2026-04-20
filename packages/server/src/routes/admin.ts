import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  createMemberByAdmin,
  createMembersByAdminBatch,
  listMemberDirectoryForActor,
  updateMemberByAdmin,
} from '../services/AuthService.js';
import type { Actor } from '../types/actor.js';

const createMemberBody = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  password: z.string().min(8).optional(),
  accountRole: z.enum(['admin', 'member', 'guest']).optional(),
});

const batchMembersBody = z.object({
  accountRole: z.enum(['admin', 'member', 'guest']).optional(),
  entries: z
    .array(
      z.object({
        email: z.string().email(),
        displayName: z.string().min(1).max(120).optional(),
      }),
    )
    .min(1)
    .max(200),
});

const patchMemberBody = z
  .object({
    email: z.string().email().optional(),
    displayName: z.string().min(1).max(120).optional(),
    accountRole: z.enum(['admin', 'member', 'guest']).optional(),
    password: z.string().min(8).optional(),
  })
  .refine(
    (d) =>
      d.email !== undefined ||
      d.displayName !== undefined ||
      d.accountRole !== undefined ||
      d.password !== undefined,
    { message: 'At least one field is required' },
  );

export const adminRouter = new Hono<{ Variables: { actor: Actor } }>()
  .use('*', requireAuth)
  .get('/members', async (c) => {
    const actor = c.get('actor');
    if (actor.type !== 'member') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    try {
      const members = await listMemberDirectoryForActor(actor);
      return c.json({ members });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to list members';
      if (msg === 'Forbidden') return c.json({ error: msg }, 403);
      return c.json({ error: msg }, 400);
    }
  })
  .post('/members', requireAdmin, zValidator('json', createMemberBody), async (c) => {
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
  })
  .post('/members/batch', requireAdmin, zValidator('json', batchMembersBody), async (c) => {
    const body = c.req.valid('json');
    try {
      const out = await createMembersByAdminBatch({
        accountRole: body.accountRole,
        entries: body.entries,
      });
      return c.json(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create users';
      return c.json({ error: msg }, 400);
    }
  })
  .patch('/members/:id', requireAdmin, zValidator('json', patchMemberBody), async (c) => {
    const memberId = c.req.param('id');
    const body = c.req.valid('json');
    const actor = c.get('actor');
    try {
      const out = await updateMemberByAdmin(actor, memberId, body);
      return c.json(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update user';
      if (msg === 'Member not found') return c.json({ error: msg }, 404);
      if (msg === 'Forbidden') return c.json({ error: msg }, 403);
      if (msg.includes('already')) return c.json({ error: msg }, 409);
      return c.json({ error: msg }, 400);
    }
  });
