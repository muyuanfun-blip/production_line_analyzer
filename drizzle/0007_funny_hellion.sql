CREATE TABLE `simulation_scenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionLineId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`baseSnapshotId` int,
	`workstationsData` json NOT NULL,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `simulation_scenarios_id` PRIMARY KEY(`id`)
);
