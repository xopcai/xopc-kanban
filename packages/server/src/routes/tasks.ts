import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../services/ProjectService.js';
import { memoryService } from '../services/MemoryService.js';
import { taskService } from '../services/TaskService.js';
import type { Actor } from '../types/actor.js';
import type { TaskPriority, TaskStatus } from '../types/index.js';

const dependencyBody = z.object({
  dependsOnId: z.string().min(1),
  type: z.enum(['blocks', 'blocked_by', 'related']).optional(),
});

const taskStatusZ = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
  'cancelled',
]);

const taskPriorityZ = z.enum(['urgent', 'high', 'medium', 'low', 'none']);

const createBody = z
  .object({
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    status: taskStatusZ.optional(),
    priority: taskPriorityZ.optional(),
    projectId: z.string().min(1).optional(),
    parentId: z.string().min(1).nullable().optional(),
    intent: z.string().optional(),
    dueDate: z.string().nullable().optional(),
    position: z.number().optional(),
    labelIds: z.array(z.string()).optional(),
  })
  .refine((d) => d.parentId != null || d.projectId != null, {
    message: 'projectId is required unless parentId is set',
    path: ['projectId'],
  });

const patchBody = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    priority: taskPriorityZ.optional(),
    projectId: z.string().min(1).nullable().optional(),
    parentId: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    intent: z.string().optional(),
    acceptanceCriteria: z.array(z.string()).optional(),
    contextRefs: z
      .array(
        z.object({
          type: z.enum(['url', 'file', 'snippet']),
          title: z.string(),
          value: z.string(),
        }),
      )
      .optional(),
    assigneeType: z.enum(['member', 'agent']).nullable().optional(),
    assigneeId: z.string().nullable().optional(),
    position: z.number().optional(),
    labelIds: z.array(z.string()).optional(),
  })
  .strict();

const statusBody = z.object({
  status: taskStatusZ,
  note: z.string().optional(),
});

const subtaskBody = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
});

const memoryBody = z.object({
  content: z.string().min(1),
  type: z
    .enum(['comment', 'status_change', 'progress_update', 'system'])
    .optional(),
  parentId: z.string().nullable().optional(),
});

const batchBody = z.object({
  ids: z.array(z.string()).min(1),
  action: z.enum(['delete', 'set_status']),
  status: taskStatusZ.optional(),
});

function jsonHttpError(c: { json: (b: object, s: 400 | 403 | 404 | 500) => Response }, e: unknown) {
  if (e instanceof HttpError) {
    const s = e.status;
    if (s === 400 || s === 403 || s === 404) return c.json({ error: e.message }, s);
    return c.json({ error: e.message }, 500);
  }
  if (e instanceof Error) return c.json({ error: e.message }, 500);
  return c.json({ error: 'Server error' }, 500);
}

export const tasksRouter = new Hono<{ Variables: { actor: Actor } }>()
  .use('*', requireAuth)
  .get('/', async (c) => {
    try {
      const status = c.req.query('status') as TaskStatus | undefined;
      const priority = c.req.query('priority') as TaskPriority | undefined;
      const assigneeRaw = c.req.query('assigneeId');
      let assigneeId: string | null | undefined = undefined;
      if (assigneeRaw === '__none__') assigneeId = null;
      else if (assigneeRaw) assigneeId = assigneeRaw;
      const labelId = c.req.query('labelId') || undefined;
      const projectId = c.req.query('projectId');
      const parentId = c.req.query('parentId');
      const rootOnly = c.req.query('rootOnly') === '1' || c.req.query('rootOnly') === 'true';

      if (!projectId) {
        return c.json({ error: 'projectId is required' }, 400);
      }

      const tasks = await taskService.list({
        actor: c.get('actor'),
        projectId,
        status,
        priority,
        assigneeId,
        labelId,
        parentId:
          parentId === undefined ? undefined : parentId === '' ? null : parentId,
        rootOnly,
      });
      return c.json(tasks);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .post('/batch', zValidator('json', batchBody), async (c) => {
    try {
      const body = c.req.valid('json');
      const actor = c.get('actor');
      if (body.action === 'delete') {
        await taskService.bulkDelete(body.ids, actor);
        return c.json({ ok: true });
      }
      if (!body.status) return c.json({ error: 'status required' }, 400);
      await taskService.bulkSetStatus(body.ids, body.status, actor);
      return c.json({ ok: true });
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .post('/', zValidator('json', createBody), async (c) => {
    try {
      const body = c.req.valid('json');
      const task = await taskService.create(body, c.get('actor'));
      return c.json(task, 201);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .get('/:id/graph', async (c) => {
    try {
      const graph = await taskService.getGraph(c.req.param('id'), c.get('actor'));
      if (!graph) return c.json({ error: 'Not found' }, 404);
      return c.json(graph);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .get('/:id/dependencies', async (c) => {
    try {
      const edges = await taskService.listDependencies(
        c.req.param('id'),
        c.get('actor'),
      );
      return c.json(edges);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .post('/:id/dependencies', zValidator('json', dependencyBody), async (c) => {
    try {
      const body = c.req.valid('json');
      const edge = await taskService.addDependency(
        c.req.param('id'),
        body.dependsOnId,
        c.get('actor'),
        body.type ?? 'blocks',
      );
      return c.json(edge, 201);
    } catch (e) {
      if (e instanceof Error && !('status' in e)) {
        return c.json({ error: e.message }, 400);
      }
      return jsonHttpError(c, e);
    }
  })
  .delete('/:id/dependencies/:edgeId', async (c) => {
    try {
      const ok = await taskService.removeDependency(
        c.req.param('edgeId'),
        c.req.param('id'),
        c.get('actor'),
      );
      if (!ok) return c.json({ error: 'Not found' }, 404);
      return c.body(null, 204);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .get('/:id/memory', async (c) => {
    try {
      const items = await memoryService.list(c.req.param('id'), c.get('actor'));
      return c.json(items);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .post('/:id/memory', zValidator('json', memoryBody), async (c) => {
    try {
      const body = c.req.valid('json');
      const entry = await memoryService.add(c.req.param('id'), body, c.get('actor'));
      return c.json(entry, 201);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .delete('/:id/memory/:memId', async (c) => {
    try {
      const ok = await memoryService.delete(
        c.req.param('id'),
        c.req.param('memId'),
        c.get('actor'),
      );
      if (!ok) return c.json({ error: 'Not found' }, 404);
      return c.body(null, 204);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .get('/:id', async (c) => {
    try {
      const task = await taskService.getById(c.req.param('id'), c.get('actor'));
      if (!task) return c.json({ error: 'Not found' }, 404);
      return c.json(task);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .patch('/:id/status', zValidator('json', statusBody), async (c) => {
    try {
      const { status, note } = c.req.valid('json');
      const task = await taskService.setStatus(
        c.req.param('id'),
        status,
        c.get('actor'),
        note,
      );
      if (!task) return c.json({ error: 'Not found' }, 404);
      return c.json(task);
    } catch (e) {
      if (e instanceof Error && !(e instanceof HttpError)) {
        return c.json({ error: e.message }, 400);
      }
      return jsonHttpError(c, e);
    }
  })
  .post('/:id/subtasks', zValidator('json', subtaskBody), async (c) => {
    try {
      const body = c.req.valid('json');
      const task = await taskService.createSubtask(
        c.req.param('id'),
        body,
        c.get('actor'),
      );
      if (!task) return c.json({ error: 'Parent not found' }, 404);
      return c.json(task, 201);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .patch('/:id', zValidator('json', patchBody), async (c) => {
    try {
      const body = c.req.valid('json');
      const task = await taskService.update(c.req.param('id'), body, c.get('actor'));
      if (!task) return c.json({ error: 'Not found' }, 404);
      return c.json(task);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  })
  .delete('/:id', async (c) => {
    try {
      const ok = await taskService.delete(c.req.param('id'), c.get('actor'));
      if (!ok) return c.json({ error: 'Not found' }, 404);
      return c.body(null, 204);
    } catch (e) {
      return jsonHttpError(c, e);
    }
  });
