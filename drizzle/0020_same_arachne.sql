CREATE TABLE `master_data_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('production_line','workstation') NOT NULL,
	`entityId` int,
	`productionLineId` int,
	`action` enum('create','update','delete','bulk_import') NOT NULL,
	`beforeData` json,
	`afterData` json,
	`operatorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `master_data_audit_logs_id` PRIMARY KEY(`id`)
);
