CREATE TABLE `cardtrader_wishlist` (
	`user_id` text PRIMARY KEY,
	`wishlist_id` integer NOT NULL,
	CONSTRAINT `fk_cardtrader_wishlist_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "cardtrader_wishlist_id" CHECK("wishlist_id" > 0)
);
--> statement-breakpoint
CREATE TABLE `wishlist_item` (
	`user_id` text NOT NULL,
	`printing_id` text NOT NULL,
	`quantity` integer NOT NULL,
	CONSTRAINT `wishlist_item_pk` PRIMARY KEY(`user_id`, `printing_id`),
	CONSTRAINT `fk_wishlist_item_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "wishlist_item_quantity" CHECK("quantity" between 1 and 999)
);
