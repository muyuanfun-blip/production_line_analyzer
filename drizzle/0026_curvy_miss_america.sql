CREATE TABLE `time_studies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionLineId` int NOT NULL,
	`workstationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`productVariant` varchar(255),
	`versionNumber` int NOT NULL DEFAULT 1,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`defaultPerformanceRating` decimal(6,3) NOT NULL DEFAULT '1.000',
	`allowancePercent` decimal(6,2) NOT NULL DEFAULT '15.00',
	`observedAverageTime` decimal(10,2),
	`normalTime` decimal(10,2),
	`standardTime` decimal(10,2),
	`sampleCount` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdBy` int NOT NULL,
	`publishedBy` int,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_studies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_study_observations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timeStudyId` int NOT NULL,
	`observationNumber` int NOT NULL,
	`observedCycleTime` decimal(10,2) NOT NULL,
	`performanceRating` decimal(6,3),
	`isIncluded` tinyint NOT NULL DEFAULT 1,
	`exclusionReason` text,
	`notes` text,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_study_observations_id` PRIMARY KEY(`id`)
);
