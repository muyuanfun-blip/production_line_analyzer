CREATE TABLE `governance_data_completion_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionLineId` int NOT NULL,
	`sourceGapKey` varchar(96) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`recommendedProvider` varchar(255) NOT NULL,
	`assigneeId` int,
	`status` enum('open','in_progress','completed','cancelled') NOT NULL DEFAULT 'open',
	`frequencyCount` int NOT NULL,
	`threshold` int NOT NULL,
	`sourceEventId` int,
	`dueDate` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `governance_data_completion_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `governance_task_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`recipientId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `governance_task_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_consensus_review_events` ADD `resolutionStatus` enum('not_required','pending','approved','returned','closed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_consensus_review_events` ADD `manualDecision` enum('approved','returned','closed');--> statement-breakpoint
ALTER TABLE `ai_consensus_review_events` ADD `decisionNote` text;--> statement-breakpoint
ALTER TABLE `ai_consensus_review_events` ADD `roleDisagreements` json;--> statement-breakpoint
ALTER TABLE `ai_consensus_review_events` ADD `decidedBy` int;--> statement-breakpoint
ALTER TABLE `ai_consensus_review_events` ADD `decidedAt` timestamp;