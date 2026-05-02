CREATE TABLE `product_models` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionLineId` int NOT NULL,
	`modelCode` varchar(64) NOT NULL,
	`modelName` varchar(255) NOT NULL,
	`targetCycleTime` decimal(10,2),
	`batchSize` int DEFAULT 1,
	`description` text,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_models_id` PRIMARY KEY(`id`)
);
