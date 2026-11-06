CREATE TABLE `collection_item` (
	`user_id` text NOT NULL,
	`printing_id` text NOT NULL,
	`quantity` integer NOT NULL,
	CONSTRAINT `collection_item_pk` PRIMARY KEY(`user_id`, `printing_id`),
	CONSTRAINT `fk_collection_item_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "collection_item_quantity" CHECK("quantity" between 1 and 999)
);
