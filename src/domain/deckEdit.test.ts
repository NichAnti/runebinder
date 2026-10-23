import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { Copies, type DeckContents, empty } from './deck'
import { applyEdit, copiesOf } from './deckEdit'
import { type KnownPrinting, PrintingId } from './printing'

const id = PrintingId.make
const vi = id('ogn-103-298')
const viAlternate = id('ogn-103a-298')
const rune = id('ogn-007-298')
const legend = id('ogn-261-298')

const withMain = (copies: number): DeckContents => ({
  ...empty,
  main: [{ printingId: vi, copies: Copies.make(copies) }],
})

describe('deck edits', () => {
  test('adding a card puts it where its type belongs', () => {
    const cards: ReadonlyArray<KnownPrinting> = [
      { printingId: vi, maybeType: Option.some('Unit') },
      { printingId: rune, maybeType: Option.some('Rune') },
      { printingId: legend, maybeType: Option.some('Legend') },
    ]
    const added = Array.reduce(cards, empty, (contents, card) =>
      applyEdit(contents, { _tag: 'AddCard', ...card }),
    )

    expect(copiesOf(added, 'Main', vi)).toBe(1)
    expect(copiesOf(added, 'Runes', rune)).toBe(1)
    expect(added.maybeLegend).toStrictEqual(Option.some(legend))
  })

  test('stepping to zero removes the line', () => {
    expect(
      applyEdit(withMain(1), {
        _tag: 'StepCopies',
        zone: 'Main',
        printingId: vi,
        step: -1,
      }).main,
    ).toStrictEqual([])
  })

  test('moving a card takes all its copies to the other zone', () => {
    const moved = applyEdit(withMain(3), {
      _tag: 'MoveCard',
      from: 'Main',
      to: 'Sideboard',
      printingId: vi,
    })

    expect(copiesOf(moved, 'Main', vi)).toBe(0)
    expect(copiesOf(moved, 'Sideboard', vi)).toBe(3)
  })

  test('the chosen champion takes one copy out of the main deck', () => {
    const chosen = applyEdit(withMain(3), {
      _tag: 'MakeChampion',
      printingId: vi,
    })

    expect(chosen.maybeChosenChampion).toStrictEqual(Option.some(vi))
    expect(copiesOf(chosen, 'Main', vi)).toBe(2)
  })

  test('choosing another champion puts the previous one back', () => {
    const first = applyEdit(
      {
        ...withMain(2),
        main: [
          ...withMain(2).main,
          { printingId: viAlternate, copies: Copies.make(1) },
        ],
      },
      { _tag: 'MakeChampion', printingId: viAlternate },
    )
    const second = applyEdit(first, { _tag: 'MakeChampion', printingId: vi })

    expect(second.maybeChosenChampion).toStrictEqual(Option.some(vi))
    expect(copiesOf(second, 'Main', viAlternate)).toBe(1)
    expect(copiesOf(second, 'Main', vi)).toBe(1)
  })

  test('setting the champion replaces it without touching the main deck', () => {
    const set = applyEdit(withMain(2), {
      _tag: 'SetChampion',
      printingId: viAlternate,
    })

    expect(set.maybeChosenChampion).toStrictEqual(Option.some(viAlternate))
    expect(copiesOf(set, 'Main', vi)).toBe(2)
  })

  test('an additional legend is added once', () => {
    const once = applyEdit(empty, {
      _tag: 'AddAdditionalLegend',
      printingId: legend,
    })
    const twice = applyEdit(once, {
      _tag: 'AddAdditionalLegend',
      printingId: legend,
    })

    expect(twice.additionalLegends).toStrictEqual([legend])
  })

  test('clearing the champion returns its copy to the main deck', () => {
    const cleared = applyEdit(
      applyEdit(withMain(1), { _tag: 'MakeChampion', printingId: vi }),
      { _tag: 'ClearChampion' },
    )

    expect(cleared).toStrictEqual(withMain(1))
  })
})
