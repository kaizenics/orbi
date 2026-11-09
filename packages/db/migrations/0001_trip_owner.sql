DROP INDEX `trips_updated_at_idx`;--> statement-breakpoint
ALTER TABLE `trips` ADD `owner` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
CREATE INDEX `trips_owner_updated_at_idx` ON `trips` (`owner`,`updated_at`);