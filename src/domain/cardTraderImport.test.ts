import { describe, expect, test } from 'vitest'

import { printing } from '../testing'
import { importLinesOf, importedOf, matchOf } from './cardTraderImport'
import { CardId, type Printing, PrintingId } from './printing'

const base = printing({ id: PrintingId.make('tst-001-010') })
const alternate = printing({
  id: PrintingId.make('tst-001a-010'),
  variant: 'AlternateArt',
})
const other = printing({
  id: PrintingId.make('tst-002-010'),
  cardId: CardId.make('other-unit'),
})

const catalogue: Readonly<Record<string, ReadonlyArray<Printing>>> = {
  'test-unit|tst': [alternate, base],
  'recruit|tst': [base, other],
}
const printingsFor = (key: string) => catalogue[key] ?? []

describe('matchOf', () => {
  test('the standard printing of the card is picked', () => {
    expect(matchOf([alternate, base])).toStrictEqual({
      _tag: 'Matched',
      cardId: base.cardId,
      printingId: base.id,
    })
  })

  test('nothing in the catalogue is not matched', () => {
    expect(matchOf([])._tag).toBe('NotInCatalogue')
  })

  test('two different cards are ambiguous', () => {
    expect(matchOf([base, other])._tag).toBe('Ambiguous')
  })
})

describe('importLinesOf', () => {
  test('lines of the same card and set are added up', () => {
    const lines = importLinesOf(
      [
        { quantity: 1, metaName: 'test-unit', expansionCode: 'tst' },
        { quantity: 2, metaName: 'test-unit', expansionCode: 'tst' },
        { quantity: 1, metaName: 'missing', expansionCode: 'tst' },
        { quantity: 1, metaName: 'recruit', expansionCode: 'tst' },
      ],
      printingsFor,
    )

    expect(
      lines.map(({ key, quantity, match }) => [key, quantity, match._tag]),
    ).toStrictEqual([
      ['missing|tst', 1, 'NotInCatalogue'],
      ['recruit|tst', 1, 'Ambiguous'],
      ['test-unit|tst', 3, 'Matched'],
    ])
  })

  test('only matched lines are imported', () => {
    expect(
      importedOf(
        importLinesOf(
          [
            { quantity: 2, metaName: 'test-unit', expansionCode: 'tst' },
            { quantity: 1, metaName: 'missing', expansionCode: 'tst' },
          ],
          printingsFor,
        ),
      ),
    ).toStrictEqual([{ printingId: base.id, quantity: 2 }])
  })
})
