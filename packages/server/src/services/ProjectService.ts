import { and, asc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import * as sch from '../db/schema.js';
import { assertAccountCanWrite } from '../lib/accountAcl.js';
import { HttpError } from '../lib/httpError.js';
import type { Actor } from '../types/actor.js';

export type ProjectRole = 'owner' | 'admin' | 'member';

export { HttpError } from '../lib/httpError.js';

function nowIso(): string {
  return new Date().toISOString();
}

export class ProjectService {
  async getRole(projectId: string, actor: Actor): Promise<ProjectRole | null> {
    const row = await db
      .select()
      .from(sch.projectMember)
      .where(
        and(
          eq(sch.projectMember.projectId, projectId),
          eq(sch.projectMember.actorType, actor.type),
          eq(sch.projectMember.actorId, actor.id),
        ),
      )
      .get();
    if (!row) return null;
    return row.role as ProjectRole;
  }

  async assertMember(actor: Actor, projectId: string): Promise<void> {
    const r = await this.getRole(projectId, actor);
    if (!r) throw new HttpError('Not a project member', 403);
  }

  /** Owner or admin (manage members, edit project metadata). */
  async assertProjectAdmin(actor: Actor, projectId: string): Promise<void> {
    const r = await this.getRole(projectId, actor);
    if (!r || (r !== 'owner' && r !== 'admin')) {
      throw new HttpError('Insufficient permissions', 403);
    }
  }

  async assertOwner(actor: Actor, projectId: string): Promise<void> {
    const r = await this.getRole(projectId, actor);
    if (r !== 'owner') throw new HttpError('Only project owners can do this', 403);
  }

  async listForActor(actor: Actor) {
    const rows = await db
      .select({ project: sch.project })
      .from(sch.project)
      .innerJoin(
        sch.projectMember,
        eq(sch.project.id, sch.projectMember.projectId),
      )
      .where(
        and(
          eq(sch.projectMember.actorType, actor.type),
          eq(sch.projectMember.actorId, actor.id),
        ),
      )
      .orderBy(asc(sch.project.position), asc(sch.project.title));
    return rows.map((r) => r.project);
  }

  async get(projectId: string, actor: Actor) {
    await this.assertMember(actor, projectId);
    return db.select().from(sch.project).where(eq(sch.project.id, projectId)).get();
  }

  async isActorOnProject(
    projectId: string,
    actorType: 'member' | 'agent',
    actorId: string,
  ): Promise<boolean> {
    const row = await db
      .select()
      .from(sch.projectMember)
      .where(
        and(
          eq(sch.projectMember.projectId, projectId),
          eq(sch.projectMember.actorType, actorType),
          eq(sch.projectMember.actorId, actorId),
        ),
      )
      .get();
    return Boolean(row);
  }

  async create(
    actor: Actor,
    input: {
      title: string;
      description?: string | null;
      icon?: string | null;
      status?: (typeof sch.project.$inferInsert)['status'];
      priority?: (typeof sch.project.$inferInsert)['priority'];
      leadType?: 'member' | 'agent' | null;
      leadId?: string | null;
    },
  ) {
    assertAccountCanWrite(actor);
    if (actor.type !== 'member') {
      throw new HttpError('Only human members can create projects', 403);
    }
    const id = nanoid();
    const ts = nowIso();
    const maxPos = await db
      .select({
        m: sql<number>`coalesce(max(${sch.project.position}), 0)`.mapWith(Number),
      })
      .from(sch.project)
      .get();
    const nextPos = (maxPos?.m ?? 0) + 1;

    await db.insert(sch.project).values({
      id,
      title: input.title.trim(),
      description: input.description ?? null,
      icon: input.icon ?? null,
      status: input.status ?? 'planned',
      priority: input.priority ?? 'none',
      leadType: input.leadType ?? null,
      leadId: input.leadId ?? null,
      position: nextPos,
      createdAt: ts,
      updatedAt: ts,
    });

    await db.insert(sch.projectMember).values({
      projectId: id,
      actorType: 'member',
      actorId: actor.id,
      role: 'owner',
      createdAt: ts,
    });

    return db.select().from(sch.project).where(eq(sch.project.id, id)).get();
  }

  async update(
    projectId: string,
    actor: Actor,
    patch: Partial<{
      title: string;
      description: string | null;
      icon: string | null;
      status: (typeof sch.project.$inferInsert)['status'];
      priority: (typeof sch.project.$inferInsert)['priority'];
      leadType: 'member' | 'agent' | null;
      leadId: string | null;
      position: number;
    }>,
  ) {
    assertAccountCanWrite(actor);
    await this.assertProjectAdmin(actor, projectId);
    const ts = nowIso();
    const updates: Partial<typeof sch.project.$inferInsert> = { updatedAt: ts };
    if (patch.title !== undefined) updates.title = patch.title.trim();
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.icon !== undefined) updates.icon = patch.icon;
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.priority !== undefined) updates.priority = patch.priority;
    if (patch.leadType !== undefined) updates.leadType = patch.leadType;
    if (patch.leadId !== undefined) updates.leadId = patch.leadId;
    if (patch.position !== undefined) updates.position = patch.position;

    await db.update(sch.project).set(updates).where(eq(sch.project.id, projectId));
    return db.select().from(sch.project).where(eq(sch.project.id, projectId)).get();
  }

  /** Sets status to cancelled (soft delete). */
  async archive(projectId: string, actor: Actor) {
    assertAccountCanWrite(actor);
    await this.assertOwner(actor, projectId);
    return this.update(projectId, actor, { status: 'cancelled' });
  }

  async listMembers(projectId: string, actor: Actor) {
    await this.assertMember(actor, projectId);
    const rows = await db
      .select()
      .from(sch.projectMember)
      .where(eq(sch.projectMember.projectId, projectId))
      .orderBy(asc(sch.projectMember.createdAt));
    return rows;
  }

  private async actorExists(type: 'member' | 'agent', id: string): Promise<boolean> {
    if (type === 'member') {
      const r = await db.select().from(sch.member).where(eq(sch.member.id, id)).get();
      return Boolean(r);
    }
    const r = await db.select().from(sch.agent).where(eq(sch.agent.id, id)).get();
    return Boolean(r);
  }

  async addMember(
    projectId: string,
    actor: Actor,
    input: {
      actorType: 'member' | 'agent';
      actorId: string;
      role?: ProjectRole;
    },
  ) {
    assertAccountCanWrite(actor);
    await this.assertProjectAdmin(actor, projectId);
    if (!(await this.actorExists(input.actorType, input.actorId))) {
      throw new HttpError('Actor not found', 400);
    }
    const dup = await db
      .select()
      .from(sch.projectMember)
      .where(
        and(
          eq(sch.projectMember.projectId, projectId),
          eq(sch.projectMember.actorType, input.actorType),
          eq(sch.projectMember.actorId, input.actorId),
        ),
      )
      .get();
    if (dup) throw new HttpError('Already a member', 409);

    const role = input.role ?? 'member';
    if (role === 'owner') {
      throw new HttpError('Cannot add another owner directly', 400);
    }

    const ts = nowIso();
    await db.insert(sch.projectMember).values({
      projectId,
      actorType: input.actorType,
      actorId: input.actorId,
      role,
      createdAt: ts,
    });
  }

  async removeMember(
    projectId: string,
    actor: Actor,
    targetType: 'member' | 'agent',
    targetId: string,
  ) {
    assertAccountCanWrite(actor);
    await this.assertProjectAdmin(actor, projectId);
    if (actor.type === targetType && actor.id === targetId) {
      throw new HttpError('Cannot remove yourself', 400);
    }
    const row = await db
      .select()
      .from(sch.projectMember)
      .where(
        and(
          eq(sch.projectMember.projectId, projectId),
          eq(sch.projectMember.actorType, targetType),
          eq(sch.projectMember.actorId, targetId),
        ),
      )
      .get();
    if (!row) throw new HttpError('Member not found', 404);
    if (row.role === 'owner') {
      const owners = await db
        .select()
        .from(sch.projectMember)
        .where(
          and(
            eq(sch.projectMember.projectId, projectId),
            eq(sch.projectMember.role, 'owner'),
          ),
        )
        .all();
      if (owners.length <= 1) {
        throw new HttpError('Cannot remove the last owner', 400);
      }
    }

    await db
      .delete(sch.projectMember)
      .where(
        and(
          eq(sch.projectMember.projectId, projectId),
          eq(sch.projectMember.actorType, targetType),
          eq(sch.projectMember.actorId, targetId),
        ),
      );
  }

  async patchMemberRole(
    projectId: string,
    actor: Actor,
    targetType: 'member' | 'agent',
    targetId: string,
    role: ProjectRole,
  ) {
    assertAccountCanWrite(actor);
    await this.assertProjectAdmin(actor, projectId);
    if (role === 'owner') {
      throw new HttpError('Use transfer ownership (not implemented); cannot set owner via patch', 400);
    }
    const row = await db
      .select()
      .from(sch.projectMember)
      .where(
        and(
          eq(sch.projectMember.projectId, projectId),
          eq(sch.projectMember.actorType, targetType),
          eq(sch.projectMember.actorId, targetId),
        ),
      )
      .get();
    if (!row) throw new HttpError('Member not found', 404);
    if (row.role === 'owner') {
      const owners = await db
        .select()
        .from(sch.projectMember)
        .where(
          and(
            eq(sch.projectMember.projectId, projectId),
            eq(sch.projectMember.role, 'owner'),
          ),
        )
        .all();
      if (owners.length <= 1) {
        throw new HttpError('Cannot demote the last owner', 400);
      }
    }

    await db
      .update(sch.projectMember)
      .set({ role })
      .where(
        and(
          eq(sch.projectMember.projectId, projectId),
          eq(sch.projectMember.actorType, targetType),
          eq(sch.projectMember.actorId, targetId),
        ),
      );
  }
}

export const projectService = new ProjectService();
