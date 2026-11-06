import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { Deck, Printing, User } from '../../domain'
import { cardRowsOf, legendRowsOf, toDeck } from './rows'

const deckId = Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11')
const id = Printing.PrintingId.make
const copies = Deck.Copies.make

describe('deck rows', () => {
  test('a deck written as rows reads back the same', () => {
    const contents: Deck.DeckContents = {
      maybeLegend: Option.some(id('ogn-261-298')),
      maybeChosenChampion: Option.some(id('ogn-103a-298')),
      main: [
        { printingId: id('ogn-004-298'), copies: copies(3) },
        { printingId: id('ogn-103-298'), copies: copies(2) },
      ],
      runes: [{ printingId: id('ogn-007-298'), copies: copies(12) }],
      battlefields: [{ printingId: id('ogn-275-298'), copies: copies(1) }],
      sideboard: [{ printingId: id('ogn-009-298'), copies: copies(2) }],
      additionalLegends: [id('ogn-263-298'), id('ogn-262-298')],
    }
    const now = new Date(0)

    expect(
      toDeck(
        {
          id: deckId,
          userId: User.UserId.make('user-ada'),
          name: Deck.DeckName.make('Vi'),
          legendPrintingId: contents.maybeLegend,
          chosenChampionPrintingId: contents.maybeChosenChampion,
          createdAt: now,
          updatedAt: now,
        },
        [...cardRowsOf(deckId, contents)].reverse(),
        [...legendRowsOf(deckId, contents)].reverse(),
      ),
    ).toStrictEqual({ id: deckId, name: 'Vi', contents })
  })
})
