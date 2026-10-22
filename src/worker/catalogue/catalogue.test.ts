import { Effect, FileSystem, Layer, Schema } from 'effect'

import { NodeServices } from '@effect/platform-node'
import { assert, layer } from '@effect/vitest'

import { Catalogue } from '../../domain'
import { RecordedRiotGallery } from './riotGallery/layer'
import { CatalogueSource } from './source'

const CATALOGUE_FILE = 'catalogue/catalogue.json'

layer(RecordedRiotGallery.pipe(Layer.provideMerge(NodeServices.layer)))(
  'the committed catalogue',
  it => {
    it.effect('matches the recordings (run bun run catalogue:build)', () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const source = yield* CatalogueSource

        const committed = yield* fs
          .readFileString(CATALOGUE_FILE)
          .pipe(Effect.flatMap(Schema.decodeEffect(Catalogue.CatalogueJson)))
        const printings = yield* source.printings

        assert.strictEqual(committed.source, source.name)
        assert.deepStrictEqual(committed.printings, printings)
      }),
    )
  },
)
