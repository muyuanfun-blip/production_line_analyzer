ALTER TABLE `action_steps` ADD `reviewStatus` enum('unreviewed','pending','approved','rejected') DEFAULT 'unreviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `action_steps` ADD `reviewStatus` enum('unreviewed','pending','approved','rejected') NOT NULL DEFAULT 'unreviewed';--> statement-breakpoint
ALTER TABLE `action_steps` ADD `suggestedActionType` enum('value_added','non_value_added','necessary_waste');--> statement-breakpoint
ALTER TABLE `action_steps` ADD `reviewNote` text;--> statement-breakpoint
ALTER TABLE `action_steps` ADD `reviewedBy` int;--> statement-breakpoint
ALTER TABLE `action_steps` ADD `reviewedAt` timestamp;
