CREATE TABLE `ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text,
	`title` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_conversations_trip_idx` ON `ai_conversations` (`trip_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`provider` text,
	`model` text,
	`prompt_version` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_messages_conversation_idx` ON `ai_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text,
	`trip_id` text,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`base_revision` integer,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_proposals_trip_status_idx` ON `ai_proposals` (`trip_id`,`status`);--> statement-breakpoint
CREATE TABLE `destinations` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`address` text,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`visit_duration_min` integer DEFAULT 60 NOT NULL,
	`opening_hours` text,
	`opening_hours_source` text,
	`est_cost_minor` integer,
	`cost_source` text,
	`notes` text,
	`location_source` text NOT NULL,
	`source_ref` text,
	`location_verified_at` integer NOT NULL,
	`origin` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "destinations_latitude_check" CHECK("destinations"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "destinations_longitude_check" CHECK("destinations"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "destinations_duration_check" CHECK("destinations"."visit_duration_min" BETWEEN 0 AND 1440),
	CONSTRAINT "destinations_cost_check" CHECK("destinations"."est_cost_minor" IS NULL OR "destinations"."est_cost_minor" >= 0),
	CONSTRAINT "destinations_category_check" CHECK("destinations"."category" IN ('attraction', 'history', 'food', 'beach', 'nature', 'shopping', 'lodging', 'transport', 'activity', 'other')),
	CONSTRAINT "destinations_location_source_check" CHECK("destinations"."location_source" IN ('nominatim', 'photon', 'map_pin', 'import', 'seed')),
	CONSTRAINT "destinations_origin_check" CHECK("destinations"."origin" IN ('user', 'ai'))
);
--> statement-breakpoint
CREATE INDEX `destinations_trip_idx` ON `destinations` (`trip_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `destinations_trip_source_ref_uq` ON `destinations` (`trip_id`,`source_ref`) WHERE "destinations"."source_ref" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `geocode_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`op` text NOT NULL,
	`results` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `geocode_cache_expires_idx` ON `geocode_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `itinerary_items` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_day_id` text NOT NULL,
	`destination_id` text NOT NULL,
	`position` integer NOT NULL,
	`fixed_start_time` text,
	`duration_override_min` integer,
	`travel_mode_to_next` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_day_id`) REFERENCES `trip_days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `itinerary_items_day_position_uq` ON `itinerary_items` (`trip_day_id`,`position`);--> statement-breakpoint
CREATE INDEX `itinerary_items_destination_idx` ON `itinerary_items` (`destination_id`);--> statement-breakpoint
CREATE TABLE `route_leg_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`profile` text NOT NULL,
	`distance_m` real NOT NULL,
	`duration_s` real NOT NULL,
	`geometry` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `route_leg_cache_expires_idx` ON `route_leg_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `trip_days` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`date` text,
	`title` text,
	`notes` text,
	`start_time` text,
	`travel_mode` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trip_days_index_check" CHECK("trip_days"."day_index" >= 0),
	CONSTRAINT "trip_days_travel_mode_check" CHECK("trip_days"."travel_mode" IS NULL OR "trip_days"."travel_mode" IN ('driving', 'walking'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trip_days_trip_index_uq` ON `trip_days` (`trip_id`,`day_index`);--> statement-breakpoint
CREATE TABLE `trip_preferences` (
	`trip_id` text PRIMARY KEY NOT NULL,
	`pace` text NOT NULL,
	`interests` text NOT NULL,
	`day_start_time` text NOT NULL,
	`day_end_time` text NOT NULL,
	`max_daily_travel_min` integer,
	`notes` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trip_preferences_pace_check" CHECK("trip_preferences"."pace" IN ('relaxed', 'moderate', 'packed'))
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`origin_destination_id` text,
	`region_name` text,
	`region_bbox` text,
	`start_date` text,
	`end_date` text,
	`timezone` text NOT NULL,
	`currency` text NOT NULL,
	`budget_minor` integer,
	`default_travel_mode` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`origin_destination_id`) REFERENCES `destinations`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "trips_dates_check" CHECK("trips"."end_date" IS NULL OR "trips"."start_date" IS NULL OR "trips"."end_date" >= "trips"."start_date"),
	CONSTRAINT "trips_currency_check" CHECK(length("trips"."currency") = 3),
	CONSTRAINT "trips_budget_check" CHECK("trips"."budget_minor" IS NULL OR "trips"."budget_minor" >= 0),
	CONSTRAINT "trips_travel_mode_check" CHECK("trips"."default_travel_mode" IN ('driving', 'walking'))
);
--> statement-breakpoint
CREATE INDEX `trips_updated_at_idx` ON `trips` (`updated_at`);