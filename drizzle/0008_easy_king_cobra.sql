ALTER TABLE `simulation_scenarios` ADD `backgroundSvg` text;--> statement-breakpoint
ALTER TABLE `simulation_scenarios` ADD `backgroundLayers` json;--> statement-breakpoint
ALTER TABLE `simulation_scenarios` ADD `backgroundOpacity` decimal(4,2) DEFAULT '0.35';--> statement-breakpoint
ALTER TABLE `simulation_scenarios` ADD `backgroundOffsetX` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `simulation_scenarios` ADD `backgroundOffsetY` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `simulation_scenarios` ADD `backgroundScale` decimal(10,4) DEFAULT '1.0000';--> statement-breakpoint
ALTER TABLE `simulation_scenarios` ADD `backgroundFileName` varchar(255);