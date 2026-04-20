import { and, eq, isNull } from 'drizzle-orm';
import { db } from './client.js';
import * as t from './schema.js';

/** Stable id for the default project created by ACL migration / backfill. */
export const DEFAULT_PROJECT_ID = 'proj_default_acl';

/**
 * Ensures `project_member` rows exist for existing data:
 * - Creates a default project if missing.
 * - Adds all human members (first by id = owner, rest member) to default project.
 * - Assigns `task.project_id` NULL → default project.
 * - Any project with zero members gets all members (first = owner).
 * - Adds all agents as `member` on the default project so agent JWT can access tasks.
 */
export function ensureProjectAclBackfill(): void {
  const members = db.select().from(t.member).all();
  if (members.length === 0) return;

  const now = new Date().toISOString();
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));

  const defaultRow = db
    .select()
    .from(t.project)
    .where(eq(t.project.id, DEFAULT_PROJECT_ID))
    .get();
  if (!defaultRow) {
    db.insert(t.project)
      .values({
        id: DEFAULT_PROJECT_ID,
        title: 'Default workspace',
        description: null,
        icon: null,
        status: 'in_progress',
        priority: 'none',
        leadType: null,
        leadId: null,
        position: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i]!;
    const role = i === 0 ? ('owner' as const) : ('member' as const);
    const exists = db
      .select()
      .from(t.projectMember)
      .where(
        and(
          eq(t.projectMember.projectId, DEFAULT_PROJECT_ID),
          eq(t.projectMember.actorType, 'member'),
          eq(t.projectMember.actorId, m.id),
        ),
      )
      .get();
    if (!exists) {
      db.insert(t.projectMember)
        .values({
          projectId: DEFAULT_PROJECT_ID,
          actorType: 'member',
          actorId: m.id,
          role,
          createdAt: now,
        })
        .run();
    }
  }

  db.update(t.task)
    .set({ projectId: DEFAULT_PROJECT_ID })
    .where(isNull(t.task.projectId))
    .run();

  const projects = db.select({ id: t.project.id }).from(t.project).all();
  for (const proj of projects) {
    const count = db
      .select({ c: t.projectMember.projectId })
      .from(t.projectMember)
      .where(eq(t.projectMember.projectId, proj.id))
      .all().length;
    if (count > 0) continue;
    sorted.forEach((m, i) => {
      db.insert(t.projectMember)
        .values({
          projectId: proj.id,
          actorType: 'member',
          actorId: m.id,
          role: i === 0 ? 'owner' : 'member',
          createdAt: now,
        })
        .run();
    });
  }

  const agents = db.select().from(t.agent).all();
  for (const ag of agents) {
    const exists = db
      .select()
      .from(t.projectMember)
      .where(
        and(
          eq(t.projectMember.projectId, DEFAULT_PROJECT_ID),
          eq(t.projectMember.actorType, 'agent'),
          eq(t.projectMember.actorId, ag.id),
        ),
      )
      .get();
    if (!exists) {
      db.insert(t.projectMember)
        .values({
          projectId: DEFAULT_PROJECT_ID,
          actorType: 'agent',
          actorId: ag.id,
          role: 'member',
          createdAt: now,
        })
        .run();
    }
  }
}
