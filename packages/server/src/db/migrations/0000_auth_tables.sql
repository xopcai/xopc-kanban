-- Auth tables only (incremental). Existing deployments already have task/label/etc.
-- Fresh empty DB: run `pnpm db:push` once to sync full schema, then migrations.

CREATE TABLE IF NOT EXISTS `member` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `member_email_unique` ON `member` (`email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_member_email` ON `member` (`email`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by_member_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by_member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_agent_created_by` ON `agent` (`created_by_member_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_credential` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`secret_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_agent_credential_agent` ON `agent_credential` (`agent_id`);
