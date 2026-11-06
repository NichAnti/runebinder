CREATE TABLE `deck` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`legend_printing_id` text,
	`chosen_champion_printing_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_deck_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `deck_additional_legend` (
	`deck_id` text NOT NULL,
	`position` integer NOT NULL,
	`printing_id` text NOT NULL,
	CONSTRAINT `deck_additional_legend_pk` PRIMARY KEY(`deck_id`, `position`),
	CONSTRAINT `fk_deck_additional_legend_deck_id_deck_id_fk` FOREIGN KEY (`deck_id`) REFERENCES `deck`(`id`) ON DELETE CASCADE,
	CONSTRAINT "deck_additional_legend_position" CHECK("position" >= 0)
);
--> statement-breakpoint
CREATE TABLE `deck_card` (
	`deck_id` text NOT NULL,
	`zone` text NOT NULL,
	`printing_id` text NOT NULL,
	`copies` integer NOT NULL,
	CONSTRAINT `deck_card_pk` PRIMARY KEY(`deck_id`, `zone`, `printing_id`),
	CONSTRAINT `fk_deck_card_deck_id_deck_id_fk` FOREIGN KEY (`deck_id`) REFERENCES `deck`(`id`) ON DELETE CASCADE,
	CONSTRAINT "deck_card_zone" CHECK("zone" in ('Main', 'Runes', 'Battlefields', 'Sideboard')),
	CONSTRAINT "deck_card_copies" CHECK("copies" between 1 and 999)
);
