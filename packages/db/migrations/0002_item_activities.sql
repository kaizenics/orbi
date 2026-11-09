PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_itinerary_items` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_day_id` text NOT NULL,
	`destination_id` text,
	`activity_type` text,
	`title` text,
	`position` integer NOT NULL,
	`fixed_start_time` text,
	`duration_override_min` integer,
	`travel_mode_to_next` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_day_id`) REFERENCES `trip_days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "itinerary_items_kind_check" CHECK(("destination_id" IS NOT NULL AND "activity_type" IS NULL) OR ("destination_id" IS NULL AND "activity_type" IN ('wake_up', 'breakfast', 'lunch', 'dinner', 'snack', 'rest', 'free_time', 'check_in', 'check_out', 'transfer', 'other') AND "title" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_itinerary_items`("id", "trip_day_id", "destination_id", "activity_type", "title", "position", "fixed_start_time", "duration_override_min", "travel_mode_to_next", "notes", "created_at", "updated_at") SELECT "id", "trip_day_id", "destination_id", NULL, NULL, "position", "fixed_start_time", "duration_override_min", "travel_mode_to_next", "notes", "created_at", "updated_at" FROM `itinerary_items`;--> statement-breakpoint
DROP TABLE `itinerary_items`;--> statement-breakpoint
ALTER TABLE `__new_itinerary_items` RENAME TO `itinerary_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `itinerary_items_day_position_uq` ON `itinerary_items` (`trip_day_id`,`position`);--> statement-breakpoint
CREATE INDEX `itinerary_items_destination_idx` ON `itinerary_items` (`destination_id`);