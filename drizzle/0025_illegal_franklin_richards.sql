ALTER TABLE `user_account_audit_logs` MODIFY COLUMN `action` enum('create','reset_password','set_active','set_role','set_permissions','delete') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `accessProfile` varchar(32) DEFAULT 'operator' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `permissionOverrides` json;
--> statement-breakpoint
ALTER TABLE `user_account_audit_logs` MODIFY COLUMN `action` enum('create','reset_password','set_active','set_role','set_permissions','delete') NOT NULL;
