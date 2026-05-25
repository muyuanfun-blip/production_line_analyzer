CREATE TABLE `vsm_diagrams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionLineId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`versionNumber` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vsm_diagrams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vsm_flows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vsmDiagramId` int NOT NULL,
	`fromProcessId` int NOT NULL,
	`toProcessId` int NOT NULL,
	`flowType` enum('material','information','kanban') NOT NULL,
	`cycleTime` decimal(10,2),
	`quantity` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vsm_flows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vsm_processes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vsmDiagramId` int NOT NULL,
	`workstationId` int,
	`name` varchar(255) NOT NULL,
	`type` enum('process','supplier','customer','inventory','transport') NOT NULL,
	`cycleTime` decimal(10,2),
	`manpower` int,
	`valueAddedRate` decimal(5,2),
	`positionX` int NOT NULL DEFAULT 0,
	`positionY` int NOT NULL DEFAULT 0,
	`width` int NOT NULL DEFAULT 120,
	`height` int NOT NULL DEFAULT 80,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vsm_processes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vsm_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vsmDiagramId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`processesSnapshot` json NOT NULL,
	`flowsSnapshot` json NOT NULL,
	`improvementNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vsm_versions_id` PRIMARY KEY(`id`)
);
