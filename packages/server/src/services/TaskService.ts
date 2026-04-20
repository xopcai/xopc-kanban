import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import * as t from '../db/schema.js';
import type {
  ContextRef,
  DependencyType,
  Label,
  Task,
  TaskComment,
  TaskDependencyEdge,
  TaskGraphResponse,
  TaskPriority,
  TaskStatus,
} from '../types/index.js';
import { assertAccountCanWrite } from '../lib/accountAcl.js';
import type { Actor } from '../types/actor.js';
import { eventBus } from './EventBus.js';
import { HttpError, projectService } from './ProjectService.js';

const IDENT_PREFIX = process.env.TASK_IDENTIFIER_PREFIX ?? 'XOPC';

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
  private async ensureProjectAccess(
    actor: Actor,
    projectId: string | null,
  ): Promise<void> {
    if (!projectId) throw new HttpError('Task has no project', 403);
    await projectService.assertMember(actor, projectId);
  }

  private assertTransition(from: TaskStatus, to: TaskStatus): void {
    if (from === to) return;
    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed?.includes(to)) {
      throw new Error(`Invalid status transition: ${from} → ${to}`);
    }
  }

  async list(params: {
    actor: Actor;
    /** Required for ACL: scope tasks to this project. */
    projectId: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    /** `null` = unassigned only */
    assigneeId?: string | null;
    labelId?: string;
    parentId?: string | null;
    rootOnly?: boolean;
  }): Promise<Task[]> {
    await projectService.assertMember(params.actor, params.projectId);
    const conditions = [];
    if (params.status) conditions.push(eq(t.task.status, params.status));
    if (params.priority) conditions.push(eq(t.task.priority, params.priority));
    if (params.assigneeId === null) {
      conditions.push(isNull(t.task.assigneeId));
    } else if (params.assigneeId !== undefined) {
      conditions.push(eq(t.task.assigneeId, params.assigneeId));
    }
    if (params.labelId) {
      const labeled = await db
        .select({ taskId: t.taskLabel.taskId })
        .from(t.taskLabel)
        .where(eq(t.taskLabel.labelId, params.labelId));
      const taskIds = [...new Set(labeled.map((r) => r.taskId))];
      if (taskIds.length === 0) {
        return [];
      }
      conditions.push(inArray(t.task.id, taskIds));
    }
    conditions.push(eq(t.task.projectId, params.projectId));
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

  async getById(id: string, actor?: Actor): Promise<Task | null> {
    const row = await db.select().from(t.task).where(eq(t.task.id, id)).get();
    if (!row) return null;
    if (actor) await this.ensureProjectAccess(actor, row.projectId);

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

  async create(
    input: {
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
    },
    creator: Actor,
  ): Promise<Task> {
    assertAccountCanWrite(creator);
    let projectId: string | null = input.projectId ?? null;
    if (input.parentId) {
      const parent = await db
        .select()
        .from(t.task)
        .where(eq(t.task.id, input.parentId))
        .get();
      if (!parent) throw new HttpError('Parent task not found', 404);
      await this.ensureProjectAccess(creator, parent.projectId);
      projectId = parent.projectId;
    } else {
      if (!projectId) throw new HttpError('projectId is required', 400);
      await projectService.assertMember(creator, projectId);
    }

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
      projectId,
      number,
      identifier,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'backlog',
      priority: input.priority ?? 'none',
      position,
      creatorType: creator.type,
      creatorId: creator.id,
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

    const created = await this.getById(id, creator);
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
    actor: Actor,
  ): Promise<Task | null> {
    const existing = await db.select().from(t.task).where(eq(t.task.id, id)).get();
    if (!existing) return null;

    await this.ensureProjectAccess(actor, existing.projectId);
    assertAccountCanWrite(actor);
    if (patch.projectId !== undefined && patch.projectId !== existing.projectId) {
      if (!patch.projectId) throw new HttpError('Cannot remove project from task', 400);
      await projectService.assertMember(actor, patch.projectId);
    }

    const nextAssigneeType =
      patch.assigneeType !== undefined ? patch.assigneeType : existing.assigneeType;
    const nextAssigneeId =
      patch.assigneeId !== undefined ? patch.assigneeId : existing.assigneeId;
    const assigneeTouched =
      patch.assigneeType !== undefined || patch.assigneeId !== undefined;
    if (
      assigneeTouched &&
      nextAssigneeType &&
      nextAssigneeId &&
      (nextAssigneeType === 'member' || nextAssigneeType === 'agent')
    ) {
      const pid = existing.projectId;
      if (!pid) throw new HttpError('Task has no project', 400);
      const onProject = await projectService.isActorOnProject(
        pid,
        nextAssigneeType,
        nextAssigneeId,
      );
      if (!onProject) {
        const role = await projectService.getRole(pid, actor);
        if (role !== 'owner' && role !== 'admin') {
          throw new HttpError(
            'Only project owners or admins can assign tasks to someone who is not on the project yet.',
            400,
          );
        }
        await projectService.addMember(pid, actor, {
          actorType: nextAssigneeType,
          actorId: nextAssigneeId,
          role: 'member',
        });
      }
    }

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

    const next = await this.getById(id, actor);
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
    author: Actor,
    note?: string,
  ): Promise<Task | null> {
    const existing = await db.select().from(t.task).where(eq(t.task.id, id)).get();
    if (!existing) return null;

    await this.ensureProjectAccess(author, existing.projectId);
    assertAccountCanWrite(author);

    this.assertTransition(existing.status, nextStatus);
    const ts = nowIso();

    await db
      .update(t.task)
      .set({ status: nextStatus, updatedAt: ts })
      .where(eq(t.task.id, id));

    await db.insert(t.taskComment).values({
      id: nanoid(),
      taskId: id,
      authorType: author.type,
      authorId: author.id,
      content: note ?? `Status → ${nextStatus}`,
      type: 'status_change',
      parentId: null,
      createdAt: ts,
      updatedAt: ts,
    });

    const task = await this.getById(id, author);
    await eventBus.publish({
      type: 'task.status_changed',
      taskId: id,
      payload: { status: nextStatus },
      timestamp: ts,
    });
    return task;
  }

  async delete(id: string, actor: Actor): Promise<boolean> {
    const existing = await db.select().from(t.task).where(eq(t.task.id, id)).get();
    if (!existing) return false;

    await this.ensureProjectAccess(actor, existing.projectId);
    assertAccountCanWrite(actor);

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

  private async expandConnectedTaskIds(seed: string): Promise<string[]> {
    const ids = new Set<string>([seed]);
    while (true) {
      const list = [...ids];
      const rows = await db
        .select()
        .from(t.taskDependency)
        .where(
          or(
            inArray(t.taskDependency.taskId, list),
            inArray(t.taskDependency.dependsOnId, list),
          ),
        );
      const before = ids.size;
      for (const r of rows) {
        ids.add(r.taskId);
        ids.add(r.dependsOnId);
      }
      if (ids.size === before) break;
    }
    return [...ids];
  }

  /** Row (v, d): v depends on d ⇒ edge d → v (d before v). Adding v depends on d₀ creates cycle iff d₀ is reachable from v. */
  private async wouldCreateCycle(taskId: string, dependsOnId: string): Promise<boolean> {
    const rows = await db.select().from(t.taskDependency);
    const adj = new Map<string, string[]>();
    for (const r of rows) {
      const v = r.taskId;
      const d = r.dependsOnId;
      const list = adj.get(d) ?? [];
      list.push(v);
      adj.set(d, list);
    }
    const d0 = dependsOnId;
    const v0 = taskId;
    const next = adj.get(d0) ?? [];
    next.push(v0);
    adj.set(d0, next);

    const stack = [taskId];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const x = stack.pop()!;
      if (x === dependsOnId) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      for (const y of adj.get(x) ?? []) stack.push(y);
    }
    return false;
  }

  async listDependencies(
    taskId: string,
    actor: Actor,
  ): Promise<TaskDependencyEdge[]> {
    const task = await db.select().from(t.task).where(eq(t.task.id, taskId)).get();
    if (!task) throw new HttpError('Task not found', 404);
    await this.ensureProjectAccess(actor, task.projectId);

    const rows = await db
      .select()
      .from(t.taskDependency)
      .where(
        or(
          eq(t.taskDependency.taskId, taskId),
          eq(t.taskDependency.dependsOnId, taskId),
        ),
      )
      .orderBy(asc(t.taskDependency.createdAt));
    return rows.map((e) => ({
      id: e.id,
      taskId: e.taskId,
      dependsOnId: e.dependsOnId,
      type: e.type,
      createdAt: e.createdAt,
    }));
  }

  async addDependency(
    taskId: string,
    dependsOnId: string,
    actor: Actor,
    depType: DependencyType = 'blocks',
  ): Promise<TaskDependencyEdge> {
    assertAccountCanWrite(actor);
    if (taskId === dependsOnId) {
      throw new Error('Task cannot depend on itself');
    }
    const [a, b] = await Promise.all([
      db.select().from(t.task).where(eq(t.task.id, taskId)).get(),
      db.select().from(t.task).where(eq(t.task.id, dependsOnId)).get(),
    ]);
    if (!a || !b) throw new Error('Task not found');
    await this.ensureProjectAccess(actor, a.projectId);
    await this.ensureProjectAccess(actor, b.projectId);
    if (a.projectId !== b.projectId) {
      throw new HttpError('Dependencies must be within the same project', 400);
    }

    const dup = await db
      .select()
      .from(t.taskDependency)
      .where(
        and(
          eq(t.taskDependency.taskId, taskId),
          eq(t.taskDependency.dependsOnId, dependsOnId),
        ),
      )
      .get();
    if (dup) throw new Error('Dependency already exists');

    if (await this.wouldCreateCycle(taskId, dependsOnId)) {
      throw new Error('Dependency would create a cycle');
    }

    const id = nanoid();
    const ts = nowIso();
    await db.insert(t.taskDependency).values({
      id,
      taskId,
      dependsOnId,
      type: depType,
      createdAt: ts,
    });

    await eventBus.publish({
      type: 'task.dependency_changed',
      taskId,
      payload: { action: 'add', edgeId: id, dependsOnId },
      timestamp: ts,
    });

    return {
      id,
      taskId,
      dependsOnId,
      type: depType,
      createdAt: ts,
    };
  }

  async removeDependency(
    edgeId: string,
    scopeTaskId: string,
    actor: Actor,
  ): Promise<boolean> {
    const row = await db
      .select()
      .from(t.taskDependency)
      .where(eq(t.taskDependency.id, edgeId))
      .get();
    if (!row) return false;
    if (row.taskId !== scopeTaskId && row.dependsOnId !== scopeTaskId) {
      return false;
    }
    const task = await db.select().from(t.task).where(eq(t.task.id, scopeTaskId)).get();
    if (!task) return false;
    await this.ensureProjectAccess(actor, task.projectId);
    assertAccountCanWrite(actor);

    await db.delete(t.taskDependency).where(eq(t.taskDependency.id, edgeId));
    const ts = nowIso();
    await eventBus.publish({
      type: 'task.dependency_changed',
      taskId: scopeTaskId,
      payload: { action: 'remove', edgeId },
      timestamp: ts,
    });
    return true;
  }

  async createSubtask(
    parentId: string,
    input: { title: string; description?: string | null },
    creator: Actor,
  ): Promise<Task | null> {
    const parent = await db.select().from(t.task).where(eq(t.task.id, parentId)).get();
    if (!parent) return null;
    await this.ensureProjectAccess(creator, parent.projectId);
    return this.create(
      {
        title: input.title,
        description: input.description,
        parentId,
        status: 'backlog',
        projectId: parent.projectId,
      },
      creator,
    );
  }

  async getGraph(taskId: string, actor: Actor): Promise<TaskGraphResponse | null> {
    const root = await this.getById(taskId, actor);
    if (!root) return null;

    const ids = await this.expandConnectedTaskIds(taskId);
    if (ids.length === 0) {
      return { root, nodes: [root], edges: [] };
    }

    const edgeRows = await db
      .select()
      .from(t.taskDependency)
      .where(
        and(
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

  async bulkDelete(ids: string[], actor: Actor): Promise<void> {
    assertAccountCanWrite(actor);
    const unique = [...new Set(ids)];
    for (const id of unique) {
      const row = await db.select().from(t.task).where(eq(t.task.id, id)).get();
      if (row) await this.ensureProjectAccess(actor, row.projectId);
    }
    const ts = nowIso();
    db.transaction((tx) => {
      for (const id of unique) {
        tx.delete(t.task).where(eq(t.task.id, id));
      }
    });
    for (const id of unique) {
      await eventBus.publish({
        type: 'task.deleted',
        taskId: id,
        payload: { id },
        timestamp: ts,
      });
    }
  }

  async bulkSetStatus(
    ids: string[],
    nextStatus: TaskStatus,
    actor: Actor,
  ): Promise<void> {
    assertAccountCanWrite(actor);
    const unique = [...new Set(ids)];
    const ts = nowIso();
    for (const id of unique) {
      const existing = await db.select().from(t.task).where(eq(t.task.id, id)).get();
      if (!existing) continue;
      await this.ensureProjectAccess(actor, existing.projectId);
      this.assertTransition(existing.status, nextStatus);
      await db
        .update(t.task)
        .set({ status: nextStatus, updatedAt: ts })
        .where(eq(t.task.id, id));
      await eventBus.publish({
        type: 'task.status_changed',
        taskId: id,
        payload: { status: nextStatus, bulk: true },
        timestamp: ts,
      });
    }
  }
}

export const taskService = new TaskService();
