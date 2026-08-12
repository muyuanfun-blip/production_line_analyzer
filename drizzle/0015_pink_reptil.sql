ALTER TABLE `vsm_diagrams` ADD `productFamily` varchar(255);--> statement-breakpoint
ALTER TABLE `vsm_diagrams` ADD `taktTime` decimal(10,2);--> statement-breakpoint
ALTER TABLE `vsm_diagrams` ADD `demandPerShift` int;--> statement-breakpoint
ALTER TABLE `vsm_diagrams` ADD `availableTimeSec` int;--> statement-breakpoint
ALTER TABLE `vsm_flows` ADD `transportDistanceM` decimal(10,2);--> statement-breakpoint
ALTER TABLE `vsm_processes` ADD `wipQuantity` int;--> statement-breakpoint
ALTER TABLE `vsm_processes` ADD `batchSize` int;--> statement-breakpoint
ALTER TABLE `vsm_processes` ADD `availabilityRate` decimal(5,2);