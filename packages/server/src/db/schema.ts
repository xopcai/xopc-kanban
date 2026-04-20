import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const project = sqliteTable(
  'project',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    icon: text('icon'),
    status: text('status', {
      enum: ['planned', 'in_progress', 'paused', 'completed', 'cancelled'],
    })
      .notNull()
      .default('planned'),
    priority: text('priority', {
      enum: ['urgent', 'high', 'medium', 'low', 'none'],
    })
      .notNull()
      .default('none'),
    leadType: text('lead_type', { enum: ['member', 'agent'] }),
    leadId: text('lead_id'),
    position: real('position').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_project_position').on(t.position)],
);

export const member = sqliteTable(
  'member',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_member_email').on(t.email)],
);

export const agent = sqliteTable(
  'agent',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    createdByMemberId: text('created_by_member_id').references(() => member.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_agent_created_by').on(t.createdByMemberId)],
);

export const agentCredential = sqliteTable(
  'agent_credential',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agent.id, { onDelete: 'cascade' }),
    secretHash: text('secret_hash').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_agent_credential_agent').on(t.agentId)],
);

export const label = sqliteTable('label', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
});

export const task = sqliteTable(
  'task',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').references(() => project.id, {
      onDelete: 'set null',
    }),
    number: integer('number').notNull(),
    identifier: text('identifier').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', {
      enum: [
        'backlog',
        'todo',
        'in_progress',
        'in_review',
        'blocked',
        'done',
        'cancelled',
      ],
    })
      .notNull()
      .default('backlog'),
    priority: text('priority', {
      enum: ['urgent', 'high', 'medium', 'low', 'none'],
    })
      .notNull()
      .default('none'),
    position: real('position').notNull().default(0),
    creatorType: text('creator_type', { enum: ['member', 'agent'] }).notNull(),
    creatorId: text('creator_id').notNull(),
    assigneeType: text('assignee_type', { enum: ['member', 'agent'] }),
    assigneeId: text('assignee_id'),
    parentId: text('parent_id').references((): any => task.id, {
      onDelete: 'set null',
    }),
    dueDate: text('due_date'),
    intent: text('intent').notNull().default(''),
    acceptanceCriteria: text('acceptance_criteria').notNull().default('[]'),
    contextRefs: text('context_refs').notNull().default('[]'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_task_project').on(t.projectId),
    index('idx_task_status').on(t.status),
    index('idx_task_assignee').on(t.assigneeType, t.assigneeId),
    index('idx_task_parent').on(t.parentId),
    index('idx_task_number').on(t.number),
  ],
);

export const taskLabel = sqliteTable(
  'task_label',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => label.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] })],
);

export const taskDependency = sqliteTable(
  'task_dependency',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    dependsOnId: text('depends_on_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['blocks', 'blocked_by', 'related'] })
      .notNull()
      .default('blocks'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_task_dependency_task').on(t.taskId),
    index('idx_task_dependency_depends').on(t.dependsOnId),
  ],
);

export const taskComment = sqliteTable(
  'task_comment',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    authorType: text('author_type', { enum: ['member', 'agent'] }).notNull(),
    authorId: text('author_id').notNull(),
    content: text('content').notNull(),
    type: text('type', {
      enum: ['comment', 'status_change', 'progress_update', 'system'],
    })
      .notNull()
      .default('comment'),
    parentId: text('parent_id').references((): any => taskComment.id, {
      onDelete: 'cascade',
    }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_task_comment_task').on(t.taskId)],
);

export const agentRun = sqliteTable(
  'agent_run',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').notNull(),
    status: text('status', {
      enum: [
        'queued',
        'dispatched',
        'running',
        'completed',
        'failed',
        'cancelled',
      ],
    })
      .notNull()
      .default('queued'),
    priority: integer('priority').notNull().default(0),
    sessionId: text('session_id'),
    workDir: text('work_dir'),
    result: text('result'),
    error: text('error'),
    dispatchedAt: text('dispatched_at'),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('idx_agent_run_task').on(t.taskId)],
);
