import { Effect, FileSystem, Layer, Schema } from 'effect'

import { NodeServices } from '@effect/platform-node'
import { assert, layer } from '@effect/vitest'

import { Catalogue } from '../../domain'
import { buildCatalogue } from './build'
import { RecordedRiotGallery } from './riotGallery/layer'

const CATALOGUE_FILE = 'catalogue/catalogue.json'
const PRINTING_IDS_FILE = 'catalogue/printingIds.json'

layer(RecordedRiotGallery.pipe(Layer.provideMerge(NodeServices.layer)))(
  'the committed catalogue',
  it => {
    it.effect('matches the recordings (run bun run catalogue:build)', () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const committed = yield* fs
          .readFileString(CATALOGUE_FILE)
          .pipe(Effect.flatMap(Schema.decodeEffect(Catalogue.CatalogueJson)))
        const { catalogue } = yield* buildCatalogue

        assert.deepStrictEqual(committed, catalogue)
      }),
    )

    it.effect('lists every printing id (run bun run catalogue:build)', () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const committed = yield* fs
          .readFileString(PRINTING_IDS_FILE)
          .pipe(Effect.flatMap(Schema.decodeEffect(Catalogue.PrintingIdsJson)))
        const { catalogue } = yield* buildCatalogue

        assert.deepStrictEqual(committed, Catalogue.printingIdsOf(catalogue))
      }),
    )
  },
)
