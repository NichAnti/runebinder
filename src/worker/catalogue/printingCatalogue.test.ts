import { Effect } from 'effect'

import { assert, layer } from '@effect/vitest'

import { Printing } from '../../domain'
import { PrintingCatalogue } from './printingCatalogue'

layer(PrintingCatalogue.layerFrom(['ogn-066-298', 'ogn-066a-298']))(
  'the printing catalogue',
  it => {
    it.effect('knows the listed printings and nothing else', () =>
      Effect.gen(function* () {
        const catalogue = yield* PrintingCatalogue

        assert.isTrue(catalogue.has(Printing.PrintingId.make('ogn-066a-298')))
        assert.isFalse(catalogue.has(Printing.PrintingId.make('ogn-067-298')))
      }),
    )
  },
)
