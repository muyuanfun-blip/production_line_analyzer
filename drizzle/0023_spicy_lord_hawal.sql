CREATE TABLE `user_account_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetUserId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`action` enum('create','reset_password','set_active','set_role') NOT NULL,
	`beforeData` json,
	`afterData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_account_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `sessionVersion` int DEFAULT 1 NOT NULL;