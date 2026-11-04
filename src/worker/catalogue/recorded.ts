import { Effect, Layer } from 'effect'
import { existsSync } from 'node:fs'

import { NodeServices } from '@effect/platform-node'

import { buildCatalogue } from './build'
import { RecordedCardTrader } from './cardTrader/source'
import { RecordedRiotGallery } from './riotGallery/layer'

// Tests that check the real card data read responses recorded by hand into
// catalogue/recordings/ (git-ignored, never committed). Without them, for
// example in CI, those tests are skipped; the deploy's seed runs the same
// strict checks on the live data anyway.
export const HAS_RECORDINGS = existsSync('catalogue/recordings')

export const RecordedSources = Layer.mergeAll(
  RecordedRiotGallery,
  RecordedCardTrader,
).pipe(Layer.provideMerge(NodeServices.layer))

export const recordedPrintings = buildCatalogue.pipe(
  Effect.map(({ catalogue }) => catalogue.printings),
  Effect.provide(RecordedSources),
)
