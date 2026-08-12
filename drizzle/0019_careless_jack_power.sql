CREATE TABLE `vsm_improvement_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vsmDiagramId` int NOT NULL,
	`vsmProcessId` int NOT NULL,
	`sourceSnapshotId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`ownerName` varchar(128) NOT NULL,
	`dueDate` timestamp,
	`status` enum('open','in_progress','completed','cancelled') NOT NULL DEFAULT 'open',
	`createdBy` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vsm_improvement_actions_id` PRIMARY KEY(`id`)
);
