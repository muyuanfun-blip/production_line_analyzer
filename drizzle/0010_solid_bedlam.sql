CREATE TABLE `product_flow_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productInstanceId` int NOT NULL,
	`workstationId` int NOT NULL,
	`workstationName` varchar(255) NOT NULL,
	`sequenceOrder` int NOT NULL DEFAULT 0,
	`entryTime` timestamp,
	`exitTime` timestamp,
	`actualCycleTime` decimal(10,2),
	`waitTime` decimal(10,2) DEFAULT '0',
	`status` enum('normal','rework','waiting','skipped') NOT NULL DEFAULT 'normal',
	`operatorName` varchar(128),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_flow_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionLineId` int NOT NULL,
	`productModelId` int,
	`serialNumber` varchar(128) NOT NULL,
	`batchNumber` varchar(64),
	`status` enum('in_progress','completed','rework','scrapped') NOT NULL DEFAULT 'in_progress',
	`startTime` timestamp,
	`endTime` timestamp,
	`totalLeadTime` decimal(10,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_instances_id` PRIMARY KEY(`id`)
);
