import { Array, Console, Effect, FileSystem, Layer, Schema } from 'effect'

import { BunRuntime, BunServices } from '@effect/platform-bun'

import { Catalogue } from '../../src/domain'
import { RecordedRiotGallery } from '../../src/worker/catalogue/riotGallery/layer'
import { CatalogueSource } from '../../src/worker/catalogue/source'

const OUTPUT = 'catalogue/catalogue.json'

const encodeCatalogue = Schema.encodeEffect(Catalogue.CatalogueJson)

const reportRejectedRecords = Effect.fn('reportRejectedRecords')(function* (
  issues: ReadonlyArray<unknown>,
) {
  yield* Console.error(
    `Rejected ${Array.length(issues)} problem(s); ${OUTPUT} was not written:`,
  )
  yield* Effect.forEach(issues, issue => Console.error(JSON.stringify(issue)))
})

const build = Effect.gen(function* () {
  const source = yield* CatalogueSource
  const fs = yield* FileSystem.FileSystem

  const printings = yield* source.printings.pipe(
    Effect.tapError(error =>
      error._tag === 'RejectedRecords'
        ? reportRejectedRecords(error.issues)
        : Console.error(error.message),
    ),
  )

  const json = yield* encodeCatalogue(
    Catalogue.Catalogue.make({ source: source.name, printings }),
  )

  yield* fs.writeFileString(OUTPUT, `${json}\n`)
  yield* Console.log(
    `Wrote ${Array.length(printings)} printings from ${source.name} to ${OUTPUT}`,
  )
})

build.pipe(
  Effect.provide(
    RecordedRiotGallery.pipe(Layer.provideMerge(BunServices.layer)),
  ),
  BunRuntime.runMain,
)
