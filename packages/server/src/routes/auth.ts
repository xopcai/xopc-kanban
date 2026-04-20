import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { isPublicRegisterAllowed } from '../db/bootstrap-admins.js';
import { requireAuth } from '../middleware/auth.js';
import {
  exchangeAgentApiKey,
  getAgentPublic,
  getMemberPublic,
  loginMember,
  registerMember,
} from '../services/AuthService.js';
import type { Actor } from '../types/actor.js';

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(120),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const exchangeBody = z.object({
  apiKey: z.string().min(1),
});

export const authRouter = new Hono<{ Variables: { actor: Actor } }>()
  .post('/register', zValidator('json', registerBody), async (c) => {
    if (!isPublicRegisterAllowed()) {
      return c.json({ error: 'Registration is disabled' }, 403);
    }
    const body = c.req.valid('json');
    try {
      const out = await registerMember(body);
      return c.json(out, 201);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      if (msg.includes('already')) return c.json({ error: msg }, 409);
      return c.json({ error: msg }, 400);
    }
  })
  .post('/login', zValidator('json', loginBody), async (c) => {
    const body = c.req.valid('json');
    try {
      const out = await loginMember(body.email, body.password);
      return c.json(out);
    } catch {
      return c.json({ error: 'Invalid email or password' }, 401);
    }
  })
  .post('/agent/exchange', zValidator('json', exchangeBody), async (c) => {
    const { apiKey } = c.req.valid('json');
    try {
      const token = await exchangeAgentApiKey(apiKey);
      return c.json({ token });
    } catch {
      return c.json({ error: 'Invalid API key' }, 401);
    }
  })
  .get('/me', requireAuth, async (c) => {
    const actor = c.get('actor');
    if (actor.type === 'member') {
      const u = await getMemberPublic(actor.id);
      if (!u) return c.json({ error: 'Not found' }, 404);
      return c.json({ typ: 'member' as const, ...u });
    }
    const a = await getAgentPublic(actor.id);
    if (!a) return c.json({ error: 'Not found' }, 404);
    return c.json({ typ: 'agent' as const, ...a });
  });
