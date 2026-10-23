import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { Copies, type DeckCard } from './deck'
import type { DeckEdit } from './deckEdit'
import { type Domain, PrintingId } from './printing'
import { type RuneChoice, splitEvenly } from './runes'

const fury = PrintingId.make('ogn-007-298')
const furyAlternate = PrintingId.make('ogn-007a-298')
const chaos = PrintingId.make('ogn-166-298')
const calm = PrintingId.make('ogn-042-298')

const DOMAINS: Readonly<Record<string, Domain>> = {
  [fury]: 'Fury',
  [furyAlternate]: 'Fury',
  [chaos]: 'Chaos',
  [calm]: 'Calm',
}
const domainOf = (printingId: PrintingId) =>
  Option.fromNullishOr(DOMAINS[printingId])

const runes = (
  ...cards: ReadonlyArray<readonly [PrintingId, number]>
): ReadonlyArray<DeckCard> =>
  Array.map(cards, ([printingId, copies]) => ({
    printingId,
    copies: Copies.make(copies),
  }))

const choices: ReadonlyArray<RuneChoice> = [
  { domain: 'Fury', printingId: fury },
  { domain: 'Chaos', printingId: chaos },
]

const stepsOf = (edits: ReadonlyArray<DeckEdit>) =>
  Array.map(edits, edit =>
    edit._tag === 'StepCopies' ? `${edit.printingId} ${edit.step}` : edit._tag,
  )

describe('splitting runes evenly', () => {
  test('an empty rune deck gets six of each domain', () => {
    const edits = splitEvenly([], choices, domainOf)

    expect(Array.length(edits)).toBe(12)
    expect(
      Array.length(Array.filter(stepsOf(edits), step => step === `${fury} 1`)),
    ).toBe(6)
  })

  test('the version already in the deck is the one topped up', () => {
    expect(
      stepsOf(
        splitEvenly(runes([furyAlternate, 5], [chaos, 6]), choices, domainOf),
      ),
    ).toStrictEqual([`${furyAlternate} 1`])
  })

  test('extra runes of a domain are removed, others are left alone', () => {
    expect(
      stepsOf(
        splitEvenly(runes([fury, 8], [chaos, 6], [calm, 2]), choices, domainOf),
      ),
    ).toStrictEqual([`${fury} -1`, `${fury} -1`])
  })
})
