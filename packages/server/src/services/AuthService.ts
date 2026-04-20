import bcrypt from 'bcryptjs';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import * as t from '../db/schema.js';
import { signActorToken } from '../lib/token.js';
import type { AccountRole } from '../types/accountRole.js';
import type { Actor } from '../types/actor.js';

const SALT_ROUNDS = 10;

function nowIso(): string {
  return new Date().toISOString();
}

/** First 8 chars of normalized email; pad with `0` if shorter (min length 8 for storage policy). */
function defaultPasswordFromEmail(normalizedEmail: string): string {
  const head = normalizedEmail.slice(0, 8);
  return head.length >= 8 ? head : head.padEnd(8, '0');
}

function deriveDisplayNameFromEmail(normalizedEmail: string): string {
  const at = normalizedEmail.indexOf('@');
  const local = at > 0 ? normalizedEmail.slice(0, at) : normalizedEmail;
  const name = local.trim() || normalizedEmail;
  return name.slice(0, 120);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function registerMember(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{
  token: string;
  user: { id: string; email: string; displayName: string; accountRole: AccountRole };
}> {
  const id = nanoid();
  const ts = nowIso();
  const passwordHash = await hashPassword(input.password);
  const countRow = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(t.member)
    .get();
  const accountRole: AccountRole = (countRow?.c ?? 0) === 0 ? 'admin' : 'member';
  try {
    await db.insert(t.member).values({
      id,
      email: input.email.toLowerCase().trim(),
      passwordHash,
      displayName: input.displayName.trim(),
      accountRole,
      createdAt: ts,
      updatedAt: ts,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      throw new Error('Email already registered');
    }
    throw e;
  }
  const token = await signActorToken('member', id, accountRole);
  return {
    token,
    user: {
      id,
      email: input.email.toLowerCase().trim(),
      displayName: input.displayName.trim(),
      accountRole,
    },
  };
}

export async function loginMember(
  email: string,
  password: string,
): Promise<{
  token: string;
  user: { id: string; email: string; displayName: string; accountRole: AccountRole };
}> {
  const row = await db
    .select()
    .from(t.member)
    .where(eq(t.member.email, email.toLowerCase().trim()))
    .get();
  if (!row) throw new Error('Invalid email or password');
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) throw new Error('Invalid email or password');
  const accountRole = row.accountRole as AccountRole;
  const token = await signActorToken('member', row.id, accountRole);
  return {
    token,
    user: {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      accountRole,
    },
  };
}

export async function getMemberAccountRole(id: string): Promise<AccountRole | null> {
  const row = await db
    .select({ accountRole: t.member.accountRole })
    .from(t.member)
    .where(eq(t.member.id, id))
    .get();
  if (!row) return null;
  return row.accountRole as AccountRole;
}

export async function getMemberPublic(id: string): Promise<{
  id: string;
  email: string;
  displayName: string;
  accountRole: AccountRole;
} | null> {
  const row = await db.select().from(t.member).where(eq(t.member.id, id)).get();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    accountRole: row.accountRole as AccountRole,
  };
}

export async function createMemberByAdmin(input: {
  email: string;
  displayName: string;
  password?: string;
  accountRole?: AccountRole;
}): Promise<{
  user: { id: string; email: string; displayName: string; accountRole: AccountRole };
  initialPassword?: string;
}> {
  const role: AccountRole =
    input.accountRole === 'guest'
      ? 'guest'
      : input.accountRole === 'admin'
        ? 'admin'
        : 'member';
  const id = nanoid();
  const ts = nowIso();
  const email = input.email.toLowerCase().trim();
  const trimmedPwd = input.password?.trim();
  let initialPassword: string;
  if (trimmedPwd) {
    if (trimmedPwd.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    initialPassword = trimmedPwd;
  } else {
    initialPassword = defaultPasswordFromEmail(email);
  }
  const passwordHash = await hashPassword(initialPassword);
  try {
    await db.insert(t.member).values({
      id,
      email,
      passwordHash,
      displayName: input.displayName.trim(),
      accountRole: role,
      createdAt: ts,
      updatedAt: ts,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      throw new Error('Email already registered');
    }
    throw e;
  }
  return {
    user: { id, email, displayName: input.displayName.trim(), accountRole: role },
    initialPassword: trimmedPwd ? undefined : initialPassword,
  };
}

export async function createMembersByAdminBatch(input: {
  accountRole?: AccountRole;
  entries: { email: string; displayName?: string }[];
}): Promise<{
  created: Array<{
    user: { id: string; email: string; displayName: string; accountRole: AccountRole };
    initialPassword: string;
  }>;
  failed: Array<{ email: string; error: string }>;
}> {
  const role: AccountRole =
    input.accountRole === 'guest'
      ? 'guest'
      : input.accountRole === 'admin'
        ? 'admin'
        : 'member';

  const seen = new Set<string>();
  const created: Array<{
    user: { id: string; email: string; displayName: string; accountRole: AccountRole };
    initialPassword: string;
  }> = [];
  const failed: Array<{ email: string; error: string }> = [];

  for (const raw of input.entries) {
    const email = raw.email.toLowerCase().trim();
    const displayName = (raw.displayName?.trim() || deriveDisplayNameFromEmail(email)).slice(
      0,
      120,
    );
    if (seen.has(email)) {
      failed.push({ email, error: 'Duplicate in batch' });
      continue;
    }
    seen.add(email);

    try {
      const out = await createMemberByAdmin({
        email,
        displayName,
        password: undefined,
        accountRole: role,
      });
      const initialPassword = out.initialPassword ?? defaultPasswordFromEmail(email);
      created.push({ user: out.user, initialPassword });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create user';
      failed.push({ email, error: msg });
    }
  }

  return { created, failed };
}

export async function updateMemberByAdmin(
  actor: Actor,
  memberId: string,
  input: {
    email?: string;
    displayName?: string;
    accountRole?: AccountRole;
    password?: string;
  },
): Promise<{
  user: { id: string; email: string; displayName: string; accountRole: AccountRole };
  token?: string;
}> {
  if (actor.type !== 'member') {
    throw new Error('Forbidden');
  }

  const target = await db.select().from(t.member).where(eq(t.member.id, memberId)).get();
  if (!target) throw new Error('Member not found');

  const hasDisplay = input.displayName !== undefined;
  const hasRole = input.accountRole !== undefined;
  const hasEmailInput = input.email !== undefined;
  const pwd = input.password?.trim();
  const hasPassword = Boolean(pwd);

  let emailActuallyChanges = false;
  let nextEmail = target.email;
  if (hasEmailInput) {
    const normalized = input.email!.toLowerCase().trim();
    if (!normalized) {
      throw new Error('Email required');
    }
    emailActuallyChanges = normalized !== target.email;
    nextEmail = normalized;
  }

  if (!hasDisplay && !hasRole && !hasPassword && !emailActuallyChanges) {
    throw new Error('No changes');
  }

  if (hasDisplay && !input.displayName!.trim()) {
    throw new Error('Display name required');
  }

  if (emailActuallyChanges) {
    const other = await db
      .select({ id: t.member.id })
      .from(t.member)
      .where(eq(t.member.email, nextEmail))
      .get();
    if (other && other.id !== memberId) {
      throw new Error('Email already registered');
    }
  }

  if (hasRole && target.accountRole === 'admin' && input.accountRole !== 'admin') {
    const row = await db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(t.member)
      .where(eq(t.member.accountRole, 'admin'))
      .get();
    if ((row?.c ?? 0) <= 1) {
      throw new Error('Cannot remove the last admin');
    }
  }

  if (hasPassword && pwd!.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const ts = nowIso();
  const nextDisplay = hasDisplay ? input.displayName!.trim() : target.displayName;
  const nextRole = hasRole ? input.accountRole! : (target.accountRole as AccountRole);

  const updates: {
    email?: string;
    displayName: string;
    accountRole: AccountRole;
    passwordHash?: string;
    updatedAt: string;
  } = {
    displayName: nextDisplay,
    accountRole: nextRole,
    updatedAt: ts,
  };
  if (emailActuallyChanges) {
    updates.email = nextEmail;
  }
  if (hasPassword) {
    updates.passwordHash = await hashPassword(pwd!);
  }

  try {
    await db.update(t.member).set(updates).where(eq(t.member.id, memberId)).run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      throw new Error('Email already registered');
    }
    throw e;
  }

  const row = await db.select().from(t.member).where(eq(t.member.id, memberId)).get();
  if (!row) throw new Error('Member not found');

  const user = {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    accountRole: row.accountRole as AccountRole,
  };

  let token: string | undefined;
  if (actor.id === memberId && hasRole) {
    token = await signActorToken('member', memberId, user.accountRole);
  }

  return { user, token };
}

export async function listMembersForAdmin(): Promise<
  {
    id: string;
    email: string;
    displayName: string;
    accountRole: AccountRole;
    createdAt: string;
  }[]
> {
  const rows = await db
    .select({
      id: t.member.id,
      email: t.member.email,
      displayName: t.member.displayName,
      accountRole: t.member.accountRole,
      createdAt: t.member.createdAt,
    })
    .from(t.member)
    .orderBy(asc(t.member.email));
  return rows.map((r) => ({
    ...r,
    accountRole: r.accountRole as AccountRole,
  }));
}

/**
 * Member directory for the accounts UI: full roster for non-guests; guests see the same peer scope as workspace actors.
 */
export async function listMemberDirectoryForActor(actor: Actor): Promise<
  {
    id: string;
    email: string;
    displayName: string;
    accountRole: AccountRole;
    createdAt: string;
  }[]
> {
  if (actor.type !== 'member') {
    throw new Error('Forbidden');
  }
  if (actor.accountRole !== 'guest') {
    return listMembersForAdmin();
  }

  const memberships = await db
    .select({ projectId: t.projectMember.projectId })
    .from(t.projectMember)
    .where(
      and(
        eq(t.projectMember.actorType, 'member'),
        eq(t.projectMember.actorId, actor.id),
      ),
    )
    .all();
  const projectIds = [...new Set(memberships.map((m) => m.projectId))];
  if (projectIds.length === 0) {
    const self = await db
      .select({
        id: t.member.id,
        email: t.member.email,
        displayName: t.member.displayName,
        accountRole: t.member.accountRole,
        createdAt: t.member.createdAt,
      })
      .from(t.member)
      .where(eq(t.member.id, actor.id))
      .get();
    if (!self) return [];
    return [
      {
        ...self,
        accountRole: self.accountRole as AccountRole,
      },
    ];
  }

  const peerRows = await db
    .select({ actorId: t.projectMember.actorId })
    .from(t.projectMember)
    .where(
      and(
        eq(t.projectMember.actorType, 'member'),
        inArray(t.projectMember.projectId, projectIds),
      ),
    )
    .all();
  const peerIds = [...new Set(peerRows.map((r) => r.actorId))];
  if (!peerIds.includes(actor.id)) peerIds.push(actor.id);

  const rows = await db
    .select({
      id: t.member.id,
      email: t.member.email,
      displayName: t.member.displayName,
      accountRole: t.member.accountRole,
      createdAt: t.member.createdAt,
    })
    .from(t.member)
    .where(inArray(t.member.id, peerIds))
    .orderBy(asc(t.member.email));

  return rows.map((r) => ({
    ...r,
    accountRole: r.accountRole as AccountRole,
  }));
}

/** Agent accounts for the same directory UI as members (full list for non-guests; guests see agents on shared projects). */
export async function listAgentsDirectoryForActor(actor: Actor): Promise<
  { id: string; name: string; description: string | null; createdAt: string }[]
> {
  if (actor.type !== 'member') {
    throw new Error('Forbidden');
  }
  if (actor.accountRole !== 'guest') {
    const rows = await db
      .select({
        id: t.agent.id,
        name: t.agent.name,
        description: t.agent.description,
        createdAt: t.agent.createdAt,
      })
      .from(t.agent)
      .orderBy(asc(t.agent.name));
    return rows;
  }

  const memberships = await db
    .select({ projectId: t.projectMember.projectId })
    .from(t.projectMember)
    .where(
      and(
        eq(t.projectMember.actorType, 'member'),
        eq(t.projectMember.actorId, actor.id),
      ),
    )
    .all();
  const projectIds = [...new Set(memberships.map((m) => m.projectId))];
  if (projectIds.length === 0) return [];

  const agentLinkRows = await db
    .select({ actorId: t.projectMember.actorId })
    .from(t.projectMember)
    .where(
      and(
        eq(t.projectMember.actorType, 'agent'),
        inArray(t.projectMember.projectId, projectIds),
      ),
    )
    .all();
  const agentIds = [...new Set(agentLinkRows.map((r) => r.actorId))];
  if (agentIds.length === 0) return [];

  const rows = await db
    .select({
      id: t.agent.id,
      name: t.agent.name,
      description: t.agent.description,
      createdAt: t.agent.createdAt,
    })
    .from(t.agent)
    .where(inArray(t.agent.id, agentIds))
    .orderBy(asc(t.agent.name));
  return rows;
}

/** Workspace directory: guests only see humans who share a project with them (plus themselves); others see all members. */
export async function listMembersPublicForActor(actor: Actor): Promise<
  { id: string; email: string; displayName: string }[]
> {
  if (actor.type === 'agent') {
    return listMembersPublic();
  }
  if (actor.accountRole !== 'guest') {
    return listMembersPublic();
  }

  const memberships = await db
    .select({ projectId: t.projectMember.projectId })
    .from(t.projectMember)
    .where(
      and(
        eq(t.projectMember.actorType, 'member'),
        eq(t.projectMember.actorId, actor.id),
      ),
    )
    .all();
  const projectIds = [...new Set(memberships.map((m) => m.projectId))];
  if (projectIds.length === 0) {
    const self = await getMemberPublic(actor.id);
    return self ? [{ id: self.id, email: self.email, displayName: self.displayName }] : [];
  }

  const peerRows = await db
    .select({ actorId: t.projectMember.actorId })
    .from(t.projectMember)
    .where(
      and(
        eq(t.projectMember.actorType, 'member'),
        inArray(t.projectMember.projectId, projectIds),
      ),
    )
    .all();
  const peerIds = [...new Set(peerRows.map((r) => r.actorId))];
  if (!peerIds.includes(actor.id)) peerIds.push(actor.id);

  const rows = await db
    .select()
    .from(t.member)
    .where(inArray(t.member.id, peerIds))
    .all();
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
  }));
}

export async function getAgentPublic(id: string): Promise<{
  id: string;
  name: string;
  description: string | null;
} | null> {
  const row = await db.select().from(t.agent).where(eq(t.agent.id, id)).get();
  if (!row) return null;
  return { id: row.id, name: row.name, description: row.description };
}

export async function createAgentWithCredential(input: {
  name: string;
  createdByMemberId: string;
}): Promise<{
  agent: { id: string; name: string; description: string | null };
  apiKey: string;
}> {
  const agentId = nanoid();
  const credentialId = nanoid();
  const secretRaw = nanoid(32);
  const secretHash = await bcrypt.hash(secretRaw, SALT_ROUNDS);
  const ts = nowIso();

  await db.insert(t.agent).values({
    id: agentId,
    name: input.name.trim(),
    description: null,
    createdByMemberId: input.createdByMemberId,
    createdAt: ts,
    updatedAt: ts,
  });

  await db.insert(t.agentCredential).values({
    id: credentialId,
    agentId,
    secretHash,
    createdAt: ts,
  });

  return {
    agent: { id: agentId, name: input.name.trim(), description: null },
    apiKey: `${credentialId}.${secretRaw}`,
  };
}

export async function listAgents(): Promise<
  { id: string; name: string; description: string | null }[]
> {
  const rows = await db.select().from(t.agent);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
  }));
}

export async function listMembersPublic(): Promise<
  { id: string; email: string; displayName: string }[]
> {
  const rows = await db.select().from(t.member);
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
  }));
}

export async function exchangeAgentApiKey(apiKey: string): Promise<string> {
  const dot = apiKey.indexOf('.');
  if (dot <= 0 || dot === apiKey.length - 1) {
    throw new Error('Invalid API key format');
  }
  const credentialId = apiKey.slice(0, dot);
  const secret = apiKey.slice(dot + 1);
  const row = await db
    .select()
    .from(t.agentCredential)
    .where(eq(t.agentCredential.id, credentialId))
    .get();
  if (!row) throw new Error('Invalid API key');
  const ok = await bcrypt.compare(secret, row.secretHash);
  if (!ok) throw new Error('Invalid API key');
  return signActorToken('agent', row.agentId);
}
