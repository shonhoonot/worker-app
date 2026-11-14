CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`job_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`user_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `blocked_id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`city` text NOT NULL,
	`cat` text NOT NULL,
	`type` text NOT NULL,
	`level` text NOT NULL,
	`pay` integer NOT NULL,
	`unit` text NOT NULL,
	`schedule` text NOT NULL,
	`description` text NOT NULL,
	`contact` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`moderation_note` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_status_date` ON `jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `jobs_owner_date` ON `jobs` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reports_status` ON `reports` (`status`);--> statement-breakpoint
CREATE TABLE `saved` (
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `job_id`),
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
