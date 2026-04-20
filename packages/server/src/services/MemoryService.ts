import { asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import * as t from '../db/schema.js';
import { assertAccountCanWrite } from '../lib/accountAcl.js';
import type { Actor } from '../types/actor.js';
import type { CommentType, TaskComment } from '../types/index.js';
import { eventBus } from './EventBus.js';
import { HttpError, projectService } from './ProjectService.js';

function nowIso(): string {
  return new Date().toISOString();
}

function mapRow(row: typeof t.taskComment.$inferSelect): TaskComment {
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

export class MemoryService {
  async list(taskId: string, actor: Actor): Promise<TaskComment[]> {
    const task = await db.select().from(t.task).where(eq(t.task.id, taskId)).get();
    if (!task) throw new HttpError('Task not found', 404);
    if (!task.projectId) throw new HttpError('Task has no project', 403);
    await projectService.assertMember(actor, task.projectId);

    const rows = await db
      .select()
      .from(t.taskComment)
      .where(eq(t.taskComment.taskId, taskId))
      .orderBy(asc(t.taskComment.createdAt));
    return rows.map(mapRow);
  }

  async add(
    taskId: string,
    input: { content: string; type?: CommentType; parentId?: string | null },
    author: Actor,
  ): Promise<TaskComment> {
    assertAccountCanWrite(author);
    const task = await db.select().from(t.task).where(eq(t.task.id, taskId)).get();
    if (!task) throw new HttpError('Task not found', 404);
    if (!task.projectId) throw new HttpError('Task has no project', 403);
    await projectService.assertMember(author, task.projectId);

    const id = nanoid();
    const ts = nowIso();
    const type = input.type ?? 'comment';

    await db.insert(t.taskComment).values({
      id,
      taskId,
      authorType: author.type,
      authorId: author.id,
      content: input.content,
      type,
      parentId: input.parentId ?? null,
      createdAt: ts,
      updatedAt: ts,
    });

    const row = await db
      .select()
      .from(t.taskComment)
      .where(eq(t.taskComment.id, id))
      .get();
    if (!row) throw new Error('Failed to read memory entry');

    await eventBus.publish({
      type: 'memory.added',
      taskId,
      payload: { id, type },
      timestamp: ts,
    });

    return mapRow(row);
  }

  async delete(taskId: string, memId: string, actor: Actor): Promise<boolean> {
    const row = await db
      .select()
      .from(t.taskComment)
      .where(eq(t.taskComment.id, memId))
      .get();
    if (!row || row.taskId !== taskId) return false;

    const task = await db.select().from(t.task).where(eq(t.task.id, taskId)).get();
    if (!task || !task.projectId) return false;
    await projectService.assertMember(actor, task.projectId);
    assertAccountCanWrite(actor);

    await db.delete(t.taskComment).where(eq(t.taskComment.id, memId));
    const ts = nowIso();
    await eventBus.publish({
      type: 'task.updated',
      taskId,
      payload: { memoryDeleted: memId },
      timestamp: ts,
    });
    return true;
  }
}

export const memoryService = new MemoryService();
