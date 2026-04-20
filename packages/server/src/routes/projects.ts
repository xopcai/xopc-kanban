import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  HttpError,
  projectService,
  type ProjectRole,
} from '../services/ProjectService.js';
import type { Actor } from '../types/actor.js';

const projectStatusZ = z.enum([
  'planned',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
]);
const projectPriorityZ = z.enum(['urgent', 'high', 'medium', 'low', 'none']);
const memberRoleZ = z.enum(['owner', 'admin', 'member']);

const createBody = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  status: projectStatusZ.optional(),
  priority: projectPriorityZ.optional(),
  leadType: z.enum(['member', 'agent']).nullable().optional(),
  leadId: z.string().nullable().optional(),
});

const patchBody = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    status: projectStatusZ.optional(),
    priority: projectPriorityZ.optional(),
    leadType: z.enum(['member', 'agent']).nullable().optional(),
    leadId: z.string().nullable().optional(),
    position: z.number().optional(),
  })
  .strict();

const addMemberBody = z.object({
  actorType: z.enum(['member', 'agent']),
  actorId: z.string().min(1),
  role: memberRoleZ.optional(),
});

const patchMemberBody = z.object({
  role: z.enum(['admin', 'member']),
});

function handle(e: unknown): { message: string; status: 400 | 403 | 404 | 409 | 500 } {
  if (e instanceof HttpError) {
    const s = e.status;
    if (s === 400 || s === 403 || s === 404 || s === 409) {
      return { message: e.message, status: s };
    }
    return { message: e.message, status: 500 };
  }
  if (e instanceof Error) return { message: e.message, status: 500 };
  return { message: 'Server error', status: 500 };
}

export const projectsRouter = new Hono<{ Variables: { actor: Actor } }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    try {
      const list = await projectService.listForActor(c.get('actor'));
      return c.json(list);
    } catch (e) {
      const { message, status } = handle(e);
      return c.json({ error: message }, status);
    }
  })
  .post('/', zValidator('json', createBody), async (c) => {
    try {
      const body = c.req.valid('json');
      const row = await projectService.create(c.get('actor'), body);
      return c.json(row, 201);
    } catch (e) {
      const { message, status } = handle(e);
      return c.json({ error: message }, status);
    }
  })
  .get('/:id', async (c) => {
    try {
      const row = await projectService.get(c.req.param('id'), c.get('actor'));
      if (!row) return c.json({ error: 'Not found' }, 404);
      return c.json(row);
    } catch (e) {
      const { message, status } = handle(e);
      return c.json({ error: message }, status);
    }
  })
  .patch('/:id', zValidator('json', patchBody), async (c) => {
    try {
      const body = c.req.valid('json');
      const row = await projectService.update(c.req.param('id'), c.get('actor'), body);
      if (!row) return c.json({ error: 'Not found' }, 404);
      return c.json(row);
    } catch (e) {
      const { message, status } = handle(e);
      return c.json({ error: message }, status);
    }
  })
  .post('/:id/archive', async (c) => {
    try {
      const row = await projectService.archive(c.req.param('id'), c.get('actor'));
      if (!row) return c.json({ error: 'Not found' }, 404);
      return c.json(row);
    } catch (e) {
      const { message, status } = handle(e);
      return c.json({ error: message }, status);
    }
  })
  .get('/:id/members', async (c) => {
    try {
      const rows = await projectService.listMembers(c.req.param('id'), c.get('actor'));
      return c.json(rows);
    } catch (e) {
      const { message, status } = handle(e);
      return c.json({ error: message }, status);
    }
  })
  .post('/:id/members', zValidator('json', addMemberBody), async (c) => {
    try {
      const body = c.req.valid('json');
      await projectService.addMember(c.req.param('id'), c.get('actor'), body);
      return c.body(null, 204);
    } catch (e) {
      const { message, status } = handle(e);
      return c.json({ error: message }, status);
    }
  })
  .delete('/:id/members/:actorType/:actorId', async (c) => {
    try {
      const actorType = c.req.param('actorType') as 'member' | 'agent';
      if (actorType !== 'member' && actorType !== 'agent') {
        return c.json({ error: 'Invalid actor type' }, 400);
      }
      await projectService.removeMember(
        c.req.param('id'),
        c.get('actor'),
        actorType,
        c.req.param('actorId'),
      );
      return c.body(null, 204);
    } catch (e) {
      const { message, status } = handle(e);
      return c.json({ error: message }, status);
    }
  })
  .patch('/:id/members/:actorType/:actorId', zValidator('json', patchMemberBody), async (c) => {
    try {
      const body = c.req.valid('json');
      const actorType = c.req.param('actorType') as 'member' | 'agent';
      if (actorType !== 'member' && actorType !== 'agent') {
        return c.json({ error: 'Invalid actor type' }, 400);
      }
      await projectService.patchMemberRole(
        c.req.param('id'),
        c.get('actor'),
        actorType,
        c.req.param('actorId'),
        body.role as ProjectRole,
      );
      return c.body(null, 204);
    } catch (e) {
      const { message, status } = handle(e);
      return c.json({ error: message }, status);
    }
  });
