import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import {
  listAgents,
  listMembersPublicForActor,
} from '../services/AuthService.js';
import type { Actor } from '../types/actor.js';

export const workspaceRouter = new Hono<{ Variables: { actor: Actor } }>()
  .use('*', requireAuth)
  .get('/actors', async (c) => {
    const actor = c.get('actor');
    const members = await listMembersPublicForActor(actor);
    const agents = await listAgents();
    return c.json({
      members: members.map((m) => ({
        type: 'member' as const,
        id: m.id,
        displayName: m.displayName,
        email: m.email,
      })),
      agents: agents.map((a) => ({
        type: 'agent' as const,
        id: a.id,
        name: a.name,
      })),
    });
  });
