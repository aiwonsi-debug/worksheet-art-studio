CREATE TABLE `worksheet_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('clipart','border','header','drawing','upload') NOT NULL,
	`name` varchar(160) NOT NULL,
	`prompt` text,
	`storageKey` text,
	`url` text NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `worksheet_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `worksheet_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`canvasData` text NOT NULL,
	`thumbnailUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `worksheet_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `worksheet_assets` ADD CONSTRAINT `worksheet_assets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worksheet_projects` ADD CONSTRAINT `worksheet_projects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;