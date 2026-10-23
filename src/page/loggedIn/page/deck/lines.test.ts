import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { Deck, Printing } from '../../../../domain'
import { printing } from '../../../../testing'
import { energyCurveOf, groupsOf, linesOf } from './lines'

const card = (
  id: string,
  type: Printing.CardType,
  energy: number,
): Printing.Card => ({
  id: Printing.CardId.make(id),
  printings: [
    printing({
      id: Printing.PrintingId.make(`tst-${id}-010`),
      cardId: Printing.CardId.make(id),
      name: id,
      maybeSubtitle: Option.none(),
      maybeType: Option.some(type),
      maybeEnergy: Option.some(energy),
    }),
  ],
})

const big = card('900', 'Unit', 9)
const cheap = card('101', 'Unit', 1)
const spell = card('202', 'Spell', 2)
const gear = card('303', 'Gear', 0)
const idOf = (each: Printing.Card) => Array.headNonEmpty(each.printings).id
const byPrinting = new Map(
  Array.map(
    [big, cheap, spell, gear],
    (each): readonly [string, Printing.Card] => [idOf(each), each],
  ),
)
const deckCard = (each: Printing.Card, copies: number): Deck.DeckCard => ({
  printingId: idOf(each),
  copies: Deck.Copies.make(copies),
})
const lines = linesOf(
  [deckCard(big, 1), deckCard(cheap, 3), deckCard(spell, 2), deckCard(gear, 1)],
  byPrinting,
)

describe('main deck lines', () => {
  test('are grouped by type and sorted by energy', () => {
    expect(
      Array.map(groupsOf(lines), ({ group, lines: groupLines }) => [
        group,
        Array.map(groupLines, ({ label }) => label),
      ]),
    ).toStrictEqual([
      ['Unit', ['101', '900']],
      ['Spell', ['202']],
      ['Gear', ['303']],
    ])
  })

  test('the energy curve counts copies, the last column taking 7 and up', () => {
    expect(energyCurveOf(lines)).toStrictEqual([1, 3, 2, 0, 0, 0, 0, 1])
  })
})
