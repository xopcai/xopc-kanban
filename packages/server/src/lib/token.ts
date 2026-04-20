import { sign, verify } from 'hono/jwt';
import type { ActorType } from '../types/actor.js';

const JWT_ALG = 'HS256';

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set (min 16 chars) in production');
  }
  return 'xopc-dev-jwt-secret-change-me';
}

const EXP_SEC = 60 * 60 * 24 * 7; // 7d

export async function signActorToken(
  typ: ActorType,
  sub: string,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + EXP_SEC;
  return sign({ sub, typ, exp }, secret(), JWT_ALG);
}

export async function verifyActorToken(token: string): Promise<{
  sub: string;
  typ: ActorType;
}> {
  const payload = await verify(token, secret(), JWT_ALG);
  const sub = payload.sub as string | undefined;
  const typ = payload.typ as ActorType | undefined;
  if (!sub || (typ !== 'member' && typ !== 'agent')) {
    throw new Error('Invalid token payload');
  }
  return { sub, typ };
}
