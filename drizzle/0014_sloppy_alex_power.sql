CREATE TABLE `monitoring_alert_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productionLineId` int NOT NULL,
	`workstationId` int,
	`name` varchar(255) NOT NULL,
	`metric` enum('efficiency_below','waiting_products_at_least','status_equals') NOT NULL,
	`threshold` decimal(10,2),
	`statusValue` enum('normal','warning','critical','offline','idle'),
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'warning',
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monitoring_alert_rules_id` PRIMARY KEY(`id`)
);
