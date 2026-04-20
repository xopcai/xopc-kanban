import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { memoryService } from '../services/MemoryService.js';
import { taskService } from '../services/TaskService.js';
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

const createBody = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: taskStatusZ.optional(),
  priority: taskPriorityZ.optional(),
  projectId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  intent: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  position: z.number().optional(),
  labelIds: z.array(z.string()).optional(),
});

const patchBody = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    priority: taskPriorityZ.optional(),
    projectId: z.string().nullable().optional(),
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

export const tasksRouter = new Hono()
  .get('/', async (c) => {
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

    const tasks = await taskService.list({
      status,
      priority,
      assigneeId,
      labelId,
      projectId: projectId === undefined ? undefined : projectId || null,
      parentId:
        parentId === undefined ? undefined : parentId === '' ? null : parentId,
      rootOnly,
    });
    return c.json(tasks);
  })
  .post('/', zValidator('json', createBody), async (c) => {
    const body = c.req.valid('json');
    const task = await taskService.create(body);
    return c.json(task, 201);
  })
  .post('/batch', zValidator('json', batchBody), async (c) => {
    const body = c.req.valid('json');
    if (body.action === 'delete') {
      await taskService.bulkDelete(body.ids);
      return c.json({ ok: true });
    }
    if (!body.status) return c.json({ error: 'status required' }, 400);
    try {
      await taskService.bulkSetStatus(body.ids, body.status);
      return c.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bad request';
      return c.json({ error: msg }, 400);
    }
  })
  .get('/:id/graph', async (c) => {
    const graph = await taskService.getGraph(c.req.param('id'));
    if (!graph) return c.json({ error: 'Not found' }, 404);
    return c.json(graph);
  })
  .get('/:id/dependencies', async (c) => {
    const task = await taskService.getById(c.req.param('id'));
    if (!task) return c.json({ error: 'Not found' }, 404);
    const edges = await taskService.listDependencies(c.req.param('id'));
    return c.json(edges);
  })
  .post('/:id/dependencies', zValidator('json', dependencyBody), async (c) => {
    const body = c.req.valid('json');
    const task = await taskService.getById(c.req.param('id'));
    if (!task) return c.json({ error: 'Not found' }, 404);
    try {
      const edge = await taskService.addDependency(
        c.req.param('id'),
        body.dependsOnId,
        body.type ?? 'blocks',
      );
      return c.json(edge, 201);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bad request';
      return c.json({ error: msg }, 400);
    }
  })
  .delete('/:id/dependencies/:edgeId', async (c) => {
    const ok = await taskService.removeDependency(
      c.req.param('edgeId'),
      c.req.param('id'),
    );
    if (!ok) return c.json({ error: 'Not found' }, 404);
    return c.body(null, 204);
  })
  .get('/:id/memory', async (c) => {
    const items = await memoryService.list(c.req.param('id'));
    return c.json(items);
  })
  .post('/:id/memory', zValidator('json', memoryBody), async (c) => {
    const body = c.req.valid('json');
    const task = await taskService.getById(c.req.param('id'));
    if (!task) return c.json({ error: 'Not found' }, 404);
    const entry = await memoryService.add(c.req.param('id'), body);
    return c.json(entry, 201);
  })
  .delete('/:id/memory/:memId', async (c) => {
    const ok = await memoryService.delete(c.req.param('id'), c.req.param('memId'));
    if (!ok) return c.json({ error: 'Not found' }, 404);
    return c.body(null, 204);
  })
  .get('/:id', async (c) => {
    const task = await taskService.getById(c.req.param('id'));
    if (!task) return c.json({ error: 'Not found' }, 404);
    return c.json(task);
  })
  .patch('/:id/status', zValidator('json', statusBody), async (c) => {
    const { status, note } = c.req.valid('json');
    try {
      const task = await taskService.setStatus(c.req.param('id'), status, note);
      if (!task) return c.json({ error: 'Not found' }, 404);
      return c.json(task);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bad request';
      return c.json({ error: msg }, 400);
    }
  })
  .post('/:id/subtasks', zValidator('json', subtaskBody), async (c) => {
    const body = c.req.valid('json');
    const task = await taskService.createSubtask(c.req.param('id'), body);
    if (!task) return c.json({ error: 'Parent not found' }, 404);
    return c.json(task, 201);
  })
  .patch('/:id', zValidator('json', patchBody), async (c) => {
    const body = c.req.valid('json');
    const task = await taskService.update(c.req.param('id'), body);
    if (!task) return c.json({ error: 'Not found' }, 404);
    return c.json(task);
  })
  .delete('/:id', async (c) => {
    const ok = await taskService.delete(c.req.param('id'));
    if (!ok) return c.json({ error: 'Not found' }, 404);
    return c.body(null, 204);
  });
