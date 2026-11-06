CREATE TABLE `deck_cardtrader_wishlist` (
	`deck_id` text PRIMARY KEY,
	`wishlist_id` integer NOT NULL,
	CONSTRAINT `fk_deck_cardtrader_wishlist_deck_id_deck_id_fk` FOREIGN KEY (`deck_id`) REFERENCES `deck`(`id`) ON DELETE CASCADE,
	CONSTRAINT "deck_cardtrader_wishlist_id" CHECK("wishlist_id" > 0)
);
