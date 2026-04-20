import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import * as t from '../db/schema.js';
import { signActorToken } from '../lib/token.js';

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
}): Promise<{ token: string; user: { id: string; email: string; displayName: string } }> {
  const id = nanoid();
  const ts = nowIso();
  const passwordHash = await hashPassword(input.password);
  try {
    await db.insert(t.member).values({
      id,
      email: input.email.toLowerCase().trim(),
      passwordHash,
      displayName: input.displayName.trim(),
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
  const token = await signActorToken('member', id);
  return {
    token,
    user: { id, email: input.email.toLowerCase().trim(), displayName: input.displayName.trim() },
  };
}

export async function loginMember(
  email: string,
  password: string,
): Promise<{ token: string; user: { id: string; email: string; displayName: string } }> {
  const row = await db
    .select()
    .from(t.member)
    .where(eq(t.member.email, email.toLowerCase().trim()))
    .get();
  if (!row) throw new Error('Invalid email or password');
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) throw new Error('Invalid email or password');
  const token = await signActorToken('member', row.id);
  return {
    token,
    user: {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
    },
  };
}

export async function getMemberPublic(id: string): Promise<{
  id: string;
  email: string;
  displayName: string;
} | null> {
  const row = await db.select().from(t.member).where(eq(t.member.id, id)).get();
  if (!row) return null;
  return { id: row.id, email: row.email, displayName: row.displayName };
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
