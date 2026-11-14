CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`applicant_id` text NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`message` text NOT NULL,
	`dates` text NOT NULL,
	`snapshot` text NOT NULL,
	`job_revision` integer NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_job_applicant` ON `applications` (`job_id`,`applicant_id`);--> statement-breakpoint
CREATE INDEX `applications_applicant_date` ON `applications` (`applicant_id`,`updated_at`);