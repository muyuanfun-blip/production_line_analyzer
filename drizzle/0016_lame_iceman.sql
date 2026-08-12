ALTER TABLE `workstations` MODIFY COLUMN `manpower` decimal(5,2) NOT NULL DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE `workstations` MODIFY COLUMN `manpower` decimal(5,2) NOT NULL DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE `workstations` MODIFY COLUMN `morningManpower` decimal(5,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `workstations` MODIFY COLUMN `eveningManpower` decimal(5,2) DEFAULT '0.00';
