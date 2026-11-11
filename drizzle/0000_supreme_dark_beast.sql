CREATE TABLE `commands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`action` text NOT NULL,
	`row` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`acked_at` text
);
--> statement-breakpoint
CREATE TABLE `configs` (
	`device_id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`body_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text,
	`last_seq` integer
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`event_id` text NOT NULL,
	`recorded_at` text NOT NULL,
	`received_at` text NOT NULL,
	`row` integer NOT NULL,
	`type` text NOT NULL,
	`liters` real,
	`details_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_device_event_unique` ON `events` (`device_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `telemetry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` text NOT NULL,
	`seq` integer NOT NULL,
	`recorded_at` text NOT NULL,
	`received_at` text NOT NULL,
	`soil_json` text NOT NULL,
	`temperature_c` real,
	`rh_pct` real,
	`vpd_kpa` real,
	`rows_json` text NOT NULL,
	`tank_ok` integer NOT NULL,
	`pump_on` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telemetry_device_seq_unique` ON `telemetry` (`device_id`,`seq`);