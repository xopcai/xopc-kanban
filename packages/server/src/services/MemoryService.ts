import { asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import * as t from '../db/schema.js';
import type { CommentType, TaskComment } from '../types/index.js';
import { eventBus } from './EventBus.js';

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

const DEFAULT_AUTHOR = { type: 'member' as const, id: 'local-user' };

export class MemoryService {
  async list(taskId: string): Promise<TaskComment[]> {
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
  ): Promise<TaskComment> {
    const id = nanoid();
    const ts = nowIso();
    const type = input.type ?? 'comment';

    await db.insert(t.taskComment).values({
      id,
      taskId,
      authorType: DEFAULT_AUTHOR.type,
      authorId: DEFAULT_AUTHOR.id,
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

  async delete(taskId: string, memId: string): Promise<boolean> {
    const row = await db
      .select()
      .from(t.taskComment)
      .where(eq(t.taskComment.id, memId))
      .get();
    if (!row || row.taskId !== taskId) return false;

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
