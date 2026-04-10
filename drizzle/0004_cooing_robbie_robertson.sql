CREATE TABLE `hand_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actionStepId` int NOT NULL,
	`hand` enum('left','right') NOT NULL,
	`actionName` varchar(255) NOT NULL,
	`duration` decimal(10,2) NOT NULL,
	`handActionType` enum('value_added','non_value_added','necessary_waste','idle') NOT NULL DEFAULT 'value_added',
	`isIdle` int NOT NULL DEFAULT 0,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hand_actions_id` PRIMARY KEY(`id`)
);
