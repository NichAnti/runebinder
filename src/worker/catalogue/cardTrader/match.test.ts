import { Array, Effect, Layer, Option, Result } from 'effect'
import { describe, expect, test } from 'vitest'

import { NodeServices } from '@effect/platform-node'
import { assert, layer } from '@effect/vitest'

import { Printing } from '../../../domain'
import { printing } from '../../../testing'
import { HAS_RECORDINGS } from '../recorded'
import { RecordedRiotGallery } from '../riotGallery/layer'
import { CatalogueSource } from '../source'
import {
  collectorNumberOf,
  facesOf,
  indexBlueprints,
  matchPrinting,
  withBlueprints,
} from './match'
import {
  RECORDING_DIRECTORY,
  readBlueprints,
  readExpansionCodes,
} from './recording'
import type { Blueprint } from './schema'

const blueprint = (id: number, collectorNumber: string): Blueprint => ({
  id,
  name: 'Test',
  version: null,
  game_id: 22,
  category_id: 258,
  expansion_id: 1,
  fixed_properties: { collector_number: collectorNumber },
  editable_properties: [],
  card_market_ids: [],
  tcg_player_id: null,
  scryfall_id: null,
  image_url: 'https://example.com/test.png',
  image: null,
  back_image: null,
})

const printingWithId = (id: string) =>
  printing({
    id: Printing.PrintingId.make(id),
    set: Printing.SetCode.make('TST'),
  })

describe('collectorNumberOf', () => {
  test.each([
    ['tst-007-298', '007'],
    ['tst-007a-298', '007a'],
    ['tst-299-star-298', '299s'],
    ['tst-r01', 'R01'],
    ['tst-sp1-005', 'SP1'],
    ['tst-t04', 'T04'],
  ])('%s is %s on CardTrader', (id, number) => {
    expect(collectorNumberOf(Printing.PrintingId.make(id))).toStrictEqual(
      Option.some(number),
    )
  })
})

describe('facesOf', () => {
  test('drops the set total and splits double-sided numbers', () => {
    expect(facesOf('SP1/005')).toStrictEqual(['SP1'])
    expect(facesOf('T03 // T04')).toStrictEqual(['T03', 'T04'])
  })
})

describe('matchPrinting', () => {
  const index = indexBlueprints([
    blueprint(1, '007'),
    blueprint(2, '007a'),
    blueprint(3, 'T02'),
    blueprint(4, 'T02 // T03'),
    blueprint(5, 'R02'),
    blueprint(6, 'R02'),
  ])

  test('an exact number matches', () => {
    expect(matchPrinting(index, printingWithId('tst-007a-010'))).toStrictEqual({
      _tag: 'Matched',
      blueprintId: 2,
    })
  })

  test('a single-faced blueprint wins over a double-sided one', () => {
    expect(matchPrinting(index, printingWithId('tst-t02'))).toStrictEqual({
      _tag: 'Matched',
      blueprintId: 3,
    })
  })

  test('a face found only on a double-sided blueprint matches it', () => {
    expect(matchPrinting(index, printingWithId('tst-t03'))).toStrictEqual({
      _tag: 'Matched',
      blueprintId: 4,
    })
  })

  test('two blueprints with the same number are ambiguous', () => {
    expect(matchPrinting(index, printingWithId('tst-r02'))._tag).toBe(
      'Ambiguous',
    )
  })

  test('a number CardTrader does not have is unmatched', () => {
    expect(matchPrinting(index, printingWithId('tst-099-010'))._tag).toBe(
      'Unmatched',
    )
  })

  test('a match keeps the CardTrader slug and expansion code', () => {
    const report = Result.getOrThrow(
      withBlueprints(
        [printingWithId('tst-007-010')],
        { TST: [{ ...blueprint(1, '007'), name: 'Ahri - Alluring' }] },
        { 1: 'tst' },
      ),
    )

    expect(Array.map(report.printings, p => p.maybeCardTrader)).toStrictEqual([
      Option.some({
        id: Printing.CardTraderBlueprintId.make(1),
        metaName: Printing.CardTraderSlug.make('ahri-alluring'),
        expansionCode: Printing.CardTraderExpansionCode.make('tst'),
      }),
    ])
  })

  test('a blueprint in an unknown expansion rejects the whole build', () => {
    expect(
      Result.isFailure(
        withBlueprints(
          [printingWithId('tst-007-010')],
          { TST: [blueprint(1, '007')] },
          {},
        ),
      ),
    ).toBe(true)
  })

  test('an ambiguous match rejects the whole build', () => {
    expect(
      Result.isFailure(
        withBlueprints(
          [printingWithId('tst-r02')],
          { TST: [blueprint(5, 'R02'), blueprint(6, 'R02')] },
          { 1: 'tst' },
        ),
      ),
    ).toBe(true)
  })
})

describe.skipIf(!HAS_RECORDINGS)('with the recorded card data', () => {
  layer(RecordedRiotGallery.pipe(Layer.provideMerge(NodeServices.layer)))(
    'the recordings',
    it => {
      it.effect('every recorded CardTrader file parses strictly', () =>
        Effect.gen(function* () {
          const blueprintsBySet = yield* readBlueprints(RECORDING_DIRECTORY)
          assert.deepStrictEqual(
            Array.sort(Object.keys(blueprintsBySet), (a: string, b: string) =>
              a < b ? -1 : 1,
            ),
            ['OGN', 'OGS', 'RAD', 'SFD', 'UNL', 'VEN'],
          )
        }),
      )

      it.effect('every printing matches exactly one CardTrader blueprint', () =>
        Effect.gen(function* () {
          const source = yield* CatalogueSource
          const printings = yield* source.printings
          const blueprintsBySet = yield* readBlueprints(RECORDING_DIRECTORY)
          const expansionCodes = yield* readExpansionCodes(RECORDING_DIRECTORY)
          const report = Result.getOrThrow(
            withBlueprints(printings, blueprintsBySet, expansionCodes),
          )

          assert.deepStrictEqual(report.unmatched, [])
          assert.isTrue(
            Array.every(report.printings, ({ maybeCardTrader }) =>
              Option.isSome(maybeCardTrader),
            ),
          )
        }),
      )
    },
  )
})
