import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import * as t from '../db/schema.js';
import type {
  ContextRef,
  Label,
  Task,
  TaskComment,
  TaskDependencyEdge,
  TaskGraphResponse,
  TaskPriority,
  TaskStatus,
} from '../types/index.js';
import { eventBus } from './EventBus.js';

const IDENT_PREFIX = process.env.TASK_IDENTIFIER_PREFIX ?? 'XOPC';

const DEFAULT_CREATOR = {
  type: 'member' as const,
  id: 'local-user',
};

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ['todo', 'in_progress', 'cancelled'],
  todo: ['backlog', 'in_progress', 'cancelled'],
  in_progress: ['in_review', 'blocked', 'done', 'cancelled'],
  in_review: ['in_progress', 'done', 'blocked', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  done: ['todo', 'in_progress', 'backlog', 'cancelled'],
  cancelled: ['backlog', 'todo'],
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function mapComment(row: typeof t.taskComment.$inferSelect): TaskComment {
  return {
    id: row.id,
    taskId: row.taskId,
    authorType: row.authorType,
    authorId: row.authorId,
    content: row.content,
    type: row.type,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function loadLabelsForTasks(taskIds: string[]): Promise<Map<string, Label[]>> {
  const map = new Map<string, Label[]>();
  if (taskIds.length === 0) return map;
  const rows = await db
    .select({
      taskId: t.taskLabel.taskId,
      labelId: t.label.id,
      name: t.label.name,
      color: t.label.color,
    })
    .from(t.taskLabel)
    .innerJoin(t.label, eq(t.taskLabel.labelId, t.label.id))
    .where(inArray(t.taskLabel.taskId, taskIds));
  for (const r of rows) {
    const list = map.get(r.taskId) ?? [];
    list.push({ id: r.labelId, name: r.name, color: r.color });
    map.set(r.taskId, list);
  }
  return map;
}

function baseTask(
  row: typeof t.task.$inferSelect,
  labels: Label[],
): Omit<Task, 'children' | 'comments'> {
  return {
    id: row.id,
    projectId: row.projectId,
    number: row.number,
    identifier: row.identifier,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    position: row.position,
    creatorType: row.creatorType,
    creatorId: row.creatorId,
    assigneeType: row.assigneeType,
    assigneeId: row.assigneeId,
    parentId: row.parentId,
    labels,
    dueDate: row.dueDate,
    intent: row.intent,
    acceptanceCriteria: parseJsonArray<string>(row.acceptanceCriteria, []),
    contextRefs: parseJsonArray<ContextRef>(row.contextRefs, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class TaskService {
  private assertTransition(from: TaskStatus, to: TaskStatus): void {
    if (from === to) return;
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed?.includes(to)) {
      throw new Error(`Invalid status transition: ${from} → ${to}`);
    }
  }

  async list(params: {
    status?: TaskStatus;
    projectId?: string | null;
    parentId?: string | null;
    rootOnly?: boolean;
  }): Promise<Task[]> {
    const conditions = [];
    if (params.status) conditions.push(eq(t.task.status, params.status));
    if (params.projectId !== undefined) {
      if (params.projectId === null) conditions.push(isNull(t.task.projectId));
      else conditions.push(eq(t.task.projectId, params.projectId));
    }
    if (params.rootOnly) conditions.push(isNull(t.task.parentId));
    if (params.parentId !== undefined && !params.rootOnly) {
      if (params.parentId === null) conditions.push(isNull(t.task.parentId));
      else conditions.push(eq(t.task.parentId, params.parentId));
    }

    const order = [
      asc(t.task.status),
      asc(t.task.position),
      desc(t.task.updatedAt),
    ] as const;

    const rows =
      conditions.length > 0
        ? await db
            .select()
            .from(t.task)
            .where(and(...conditions))
            .orderBy(...order)
        : await db.select().from(t.task).orderBy(...order);

    const ids = rows.map((r) => r.id);
    const labelMap = await loadLabelsForTasks(ids);
    return rows.map((r) => ({
      ...baseTask(r, labelMap.get(r.id) ?? []),
      children: [],
      comments: [],
    }));
  }

  async getById(id: string): Promise<Task | null> {
    const row = await db.select().from(t.task).where(eq(t.task.id, id)).get();
    if (!row) return null;

    const childRows = await db
      .select()
      .from(t.task)
      .where(eq(t.task.parentId, id))
      .orderBy(asc(t.task.position));

    const commentRows = await db
      .select()
      .from(t.taskComment)
      .where(eq(t.taskComment.taskId, id))
      .orderBy(asc(t.taskComment.createdAt));

    const ids = [id, ...childRows.map((c) => c.id)];
    const labelMap = await loadLabelsForTasks(ids);

    const children: Task[] = childRows.map((c) => ({
      ...baseTask(c, labelMap.get(c.id) ?? []),
      children: [],
      comments: [],
    }));

    return {
      ...baseTask(row, labelMap.get(row.id) ?? []),
      children,
      comments: commentRows.map(mapComment),
    };
  }

  async create(input: {
    title: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    projectId?: string | null;
    parentId?: string | null;
    intent?: string;
    dueDate?: string | null;
    position?: number;
    labelIds?: string[];
  }): Promise<Task> {
    const id = nanoid();
    const ts = nowIso();

    const maxRow = await db
      .select({ n: sql<number>`coalesce(max(${t.task.number}), 0)`.mapWith(Number) })
      .from(t.task)
      .get();
    const number = (maxRow?.n ?? 0) + 1;
    const identifier = `${IDENT_PREFIX}-${number}`;

    let position = input.position;
    if (position === undefined) {
      const posRow = await db
        .select({
          p: sql<number>`coalesce(max(${t.task.position}), 0)`.mapWith(Number),
        })
        .from(t.task)
        .where(
          and(
            eq(t.task.status, input.status ?? 'backlog'),
            input.parentId
              ? eq(t.task.parentId, input.parentId)
              : isNull(t.task.parentId),
          ),
        )
        .get();
      position = (posRow?.p ?? 0) + 1;
    }

    await db.insert(t.task).values({
      id,
      projectId: input.projectId ?? null,
      number,
      identifier,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'backlog',
      priority: input.priority ?? 'none',
      position,
      creatorType: DEFAULT_CREATOR.type,
      creatorId: DEFAULT_CREATOR.id,
      assigneeType: null,
      assigneeId: null,
      parentId: input.parentId ?? null,
      dueDate: input.dueDate ?? null,
      intent: input.intent ?? '',
      acceptanceCriteria: '[]',
      contextRefs: '[]',
      createdAt: ts,
      updatedAt: ts,
    });

    if (input.labelIds?.length) {
      await db.insert(t.taskLabel).values(
        input.labelIds.map((labelId) => ({ taskId: id, labelId })),
      );
    }

    const created = await this.getById(id);
    if (!created) throw new Error('Failed to load created task');

    await eventBus.publish({
      type: 'task.created',
      taskId: id,
      payload: { id },
      timestamp: ts,
    });

    return created;
  }

  async update(
    id: string,
    patch: Partial<{
      title: string;
      description: string | null;
      priority: TaskPriority;
      projectId: string | null;
      parentId: string | null;
      dueDate: string | null;
      intent: string;
      acceptanceCriteria: string[];
      contextRefs: ContextRef[];
      assigneeType: 'member' | 'agent' | null;
      assigneeId: string | null;
      position: number;
      labelIds: string[];
    }>,
  ): Promise<Task | null> {
    const existing = await db.select().from(t.task).where(eq(t.task.id, id)).get();
    if (!existing) return null;

    const ts = nowIso();
    const updates: Partial<typeof t.task.$inferInsert> = { updatedAt: ts };

    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.priority !== undefined) updates.priority = patch.priority;
    if (patch.projectId !== undefined) updates.projectId = patch.projectId;
    if (patch.parentId !== undefined) updates.parentId = patch.parentId;
    if (patch.dueDate !== undefined) updates.dueDate = patch.dueDate;
    if (patch.intent !== undefined) updates.intent = patch.intent;
    if (patch.acceptanceCriteria !== undefined) {
      updates.acceptanceCriteria = JSON.stringify(patch.acceptanceCriteria);
    }
    if (patch.contextRefs !== undefined) {
      updates.contextRefs = JSON.stringify(patch.contextRefs);
    }
    if (patch.assigneeType !== undefined) updates.assigneeType = patch.assigneeType;
    if (patch.assigneeId !== undefined) updates.assigneeId = patch.assigneeId;
    if (patch.position !== undefined) updates.position = patch.position;

    if (Object.keys(updates).length > 1) {
      await db.update(t.task).set(updates).where(eq(t.task.id, id));
    }

    if (patch.labelIds) {
      await db.delete(t.taskLabel).where(eq(t.taskLabel.taskId, id));
      if (patch.labelIds.length) {
        await db.insert(t.taskLabel).values(
          patch.labelIds.map((labelId) => ({ taskId: id, labelId })),
        );
      }
    }

    const next = await this.getById(id);
    await eventBus.publish({
      type: 'task.updated',
      taskId: id,
      payload: patch,
      timestamp: ts,
    });
    return next;
  }

  async setStatus(
    id: string,
    nextStatus: TaskStatus,
    note?: string,
  ): Promise<Task | null> {
    const existing = await db.select().from(t.task).where(eq(t.task.id, id)).get();
    if (!existing) return null;

    this.assertTransition(existing.status, nextStatus);
    const ts = nowIso();

    await db
      .update(t.task)
      .set({ status: nextStatus, updatedAt: ts })
      .where(eq(t.task.id, id));

    await db.insert(t.taskComment).values({
      id: nanoid(),
      taskId: id,
      authorType: 'member',
      authorId: DEFAULT_CREATOR.id,
      content: note ?? `Status → ${nextStatus}`,
      type: 'status_change',
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    });

    const task = await this.getById(id);
    await eventBus.publish({
      type: 'task.status_changed',
      taskId: id,
      payload: { status: nextStatus },
      timestamp: ts,
    });
    return task;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await db.select().from(t.task).where(eq(t.task.id, id)).get();
    if (!existing) return false;

    await db.delete(t.task).where(eq(t.task.id, id));
    const ts = nowIso();
    await eventBus.publish({
      type: 'task.deleted',
      taskId: id,
      payload: { id },
      timestamp: ts,
    });
    return true;
  }

  async createSubtask(
    parentId: string,
    input: { title: string; description?: string | null },
  ): Promise<Task | null> {
    const parent = await db.select().from(t.task).where(eq(t.task.id, parentId)).get();
    if (!parent) return null;
    return this.create({
      title: input.title,
      description: input.description,
      parentId,
      status: 'backlog',
      projectId: parent.projectId,
    });
  }

  async getGraph(taskId: string): Promise<TaskGraphResponse | null> {
    const root = await this.getById(taskId);
    if (!root) return null;

    const collectIds = (task: Task): string[] => {
      return [task.id, ...task.children.flatMap(collectIds)];
    };
    const ids = collectIds(root);
    if (ids.length === 0) {
      return { root, nodes: [root], edges: [] };
    }

    const edgeRows = await db
      .select()
      .from(t.taskDependency)
      .where(
        or(
          inArray(t.taskDependency.taskId, ids),
          inArray(t.taskDependency.dependsOnId, ids),
        ),
      );

    const edges: TaskDependencyEdge[] = edgeRows.map((e) => ({
      id: e.id,
      taskId: e.taskId,
      dependsOnId: e.dependsOnId,
      type: e.type,
      createdAt: e.createdAt,
    }));

    const nodeRows = await db
      .select()
      .from(t.task)
      .where(inArray(t.task.id, ids))
      .orderBy(asc(t.task.position));

    const labelMap = await loadLabelsForTasks(ids);
    const nodes: Task[] = nodeRows.map((r) => ({
      ...baseTask(r, labelMap.get(r.id) ?? []),
      children: [],
      comments: [],
    }));

    return { root, nodes, edges };
  }
}

export const taskService = new TaskService();
