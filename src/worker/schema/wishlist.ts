import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { user } from './auth'
import { deck } from './deck'

export const wishlistItem = sqliteTable(
  'wishlist_item',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    printingId: text('printing_id').notNull(),
    quantity: integer('quantity').notNull(),
  },
  table => [
    primaryKey({ columns: [table.userId, table.printingId] }),
    check('wishlist_item_quantity', sql`${table.quantity} between 1 and 999`),
  ],
)

export const cardTraderWishlist = sqliteTable(
  'cardtrader_wishlist',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    wishlistId: integer('wishlist_id').notNull(),
  },
  table => [check('cardtrader_wishlist_id', sql`${table.wishlistId} > 0`)],
)

export const deckCardTraderWishlist = sqliteTable(
  'deck_cardtrader_wishlist',
  {
    deckId: text('deck_id')
      .primaryKey()
      .references(() => deck.id, { onDelete: 'cascade' }),
    wishlistId: integer('wishlist_id').notNull(),
  },
  table => [check('deck_cardtrader_wishlist_id', sql`${table.wishlistId} > 0`)],
)
