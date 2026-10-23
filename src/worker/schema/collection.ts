import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { user } from './auth'

export const collectionItem = sqliteTable(
  'collection_item',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    printingId: text('printing_id').notNull(),
    quantity: integer('quantity').notNull(),
  },
  table => [
    primaryKey({ columns: [table.userId, table.printingId] }),
    check('collection_item_quantity', sql`${table.quantity} between 1 and 999`),
  ],
)
