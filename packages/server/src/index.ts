import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import './db/client.js';
import { seedLabelsIfEmpty } from './db/seed.js';
import { agentRouter } from './routes/agent.js';
import { agentsRouter } from './routes/agents.js';
import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { labelsRouter } from './routes/labels.js';
import { tasksRouter } from './routes/tasks.js';
import { workspaceRouter } from './routes/workspace.js';

seedLabelsIfEmpty();

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.get('/health', (c) => c.json({ ok: true }));

app.route('/api/auth', authRouter);
app.route('/api/agents', agentsRouter);
app.route('/api/workspace', workspaceRouter);
app.route('/api/tasks', tasksRouter);
app.route('/api/labels', labelsRouter);
app.route('/api/events', eventsRouter);
app.route('/api/agent', agentRouter);

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`xopc server listening on http://localhost:${info.port}`);
});
