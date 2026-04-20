import bcrypt from 'bcryptjs';
import { and, asc, eq, inArray } from 'drizzle-orm';
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
  const accountRole: AccountRole = 'member';
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
    input.accountRole === 'guest' ? 'guest' : 'member';
  const id = nanoid();
  const ts = nowIso();
  const initialPassword = input.password?.trim() || nanoid(18);
  const passwordHash = await hashPassword(initialPassword);
  const email = input.email.toLowerCase().trim();
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
    initialPassword: input.password?.trim() ? undefined : initialPassword,
  };
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
