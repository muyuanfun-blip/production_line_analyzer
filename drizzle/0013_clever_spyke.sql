CREATE TABLE `monitoring_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionLineId` int NOT NULL,
	`balanceRate` decimal(6,2) NOT NULL,
	`upph` decimal(10,4) NOT NULL,
	`taktAchievement` decimal(6,2) NOT NULL,
	`productionTarget` int NOT NULL,
	`productionActual` int NOT NULL,
	`bottleneckWsId` int,
	`workstationsData` json NOT NULL,
	`anomaliesData` json NOT NULL,
	`note` text,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitoring_snapshots_id` PRIMARY KEY(`id`)
);
