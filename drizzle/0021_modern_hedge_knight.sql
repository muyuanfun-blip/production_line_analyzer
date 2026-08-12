CREATE TABLE `ai_consensus_review_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionLineId` int NOT NULL,
	`status` enum('approved','needs_clarification') NOT NULL,
	`agreementScore` int NOT NULL,
	`approvalReason` varchar(500),
	`readinessLevel` enum('ready','limited','blocked') NOT NULL,
	`completenessScore` int NOT NULL,
	`dataGaps` json NOT NULL,
	`reviews` json NOT NULL,
	`unresolvedItems` json NOT NULL,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_consensus_review_events_id` PRIMARY KEY(`id`)
);
