import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { user } from './auth'

export const deck = sqliteTable('deck', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  legendPrintingId: text('legend_printing_id'),
  chosenChampionPrintingId: text('chosen_champion_printing_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
})

export const deckCard = sqliteTable(
  'deck_card',
  {
    deckId: text('deck_id')
      .notNull()
      .references(() => deck.id, { onDelete: 'cascade' }),
    zone: text('zone', {
      enum: ['Main', 'Runes', 'Battlefields', 'Sideboard'],
    }).notNull(),
    printingId: text('printing_id').notNull(),
    copies: integer('copies').notNull(),
  },
  table => [
    primaryKey({ columns: [table.deckId, table.zone, table.printingId] }),
    check(
      'deck_card_zone',
      sql`${table.zone} in ('Main', 'Runes', 'Battlefields', 'Sideboard')`,
    ),
    check('deck_card_copies', sql`${table.copies} between 1 and 999`),
  ],
)

export const deckAdditionalLegend = sqliteTable(
  'deck_additional_legend',
  {
    deckId: text('deck_id')
      .notNull()
      .references(() => deck.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    printingId: text('printing_id').notNull(),
  },
  table => [
    primaryKey({ columns: [table.deckId, table.position] }),
    check('deck_additional_legend_position', sql`${table.position} >= 0`),
  ],
)
