-- Baseline schema (drizzle-kit). New deltas: `pnpm db:generate` → review → commit `0001_*.sql`.
CREATE TABLE `agent` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_agent_created_by` ON `agent` (`created_by_member_id`);--> statement-breakpoint
CREATE TABLE `agent_credential` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`secret_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_agent_credential_agent` ON `agent_credential` (`agent_id`);--> statement-breakpoint
CREATE TABLE `agent_run` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`session_id` text,
	`work_dir` text,
	`result` text,
	`error` text,
	`dispatched_at` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_agent_run_task` ON `agent_run` (`task_id`);--> statement-breakpoint
CREATE TABLE `label` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_email_unique` ON `member` (`email`);--> statement-breakpoint
CREATE INDEX `idx_member_email` ON `member` (`email`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`icon` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`priority` text DEFAULT 'none' NOT NULL,
	`lead_type` text,
	`lead_id` text,
	`position` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_project_position` ON `project` (`position`);--> statement-breakpoint
CREATE TABLE `project_member` (
	`project_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `actor_type`, `actor_id`),
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_project_member_actor` ON `project_member` (`actor_type`,`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_project_member_project` ON `project_member` (`project_id`);--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`number` integer NOT NULL,
	`identifier` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'backlog' NOT NULL,
	`priority` text DEFAULT 'none' NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`creator_type` text NOT NULL,
	`creator_id` text NOT NULL,
	`assignee_type` text,
	`assignee_id` text,
	`parent_id` text,
	`due_date` text,
	`intent` text DEFAULT '' NOT NULL,
	`acceptance_criteria` text DEFAULT '[]' NOT NULL,
	`context_refs` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_task_project` ON `task` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_task_status` ON `task` (`status`);--> statement-breakpoint
CREATE INDEX `idx_task_assignee` ON `task` (`assignee_type`,`assignee_id`);--> statement-breakpoint
CREATE INDEX `idx_task_parent` ON `task` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_task_number` ON `task` (`number`);--> statement-breakpoint
CREATE TABLE `task_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`author_type` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'comment' NOT NULL,
	`parent_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `task_comment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_comment_task` ON `task_comment` (`task_id`);--> statement-breakpoint
CREATE TABLE `task_dependency` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`depends_on_id` text NOT NULL,
	`type` text DEFAULT 'blocks' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_dependency_task` ON `task_dependency` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_dependency_depends` ON `task_dependency` (`depends_on_id`);--> statement-breakpoint
CREATE TABLE `task_label` (
	`task_id` text NOT NULL,
	`label_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `label_id`),
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `label`(`id`) ON UPDATE no action ON DELETE cascade
);
