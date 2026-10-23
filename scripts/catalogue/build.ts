import { Array, Console, Effect, FileSystem, Layer, Schema } from 'effect'

import { BunRuntime, BunServices } from '@effect/platform-bun'

import { Catalogue } from '../../src/domain'
import { buildCatalogue } from '../../src/worker/catalogue/build'
import { RecordedRiotGallery } from '../../src/worker/catalogue/riotGallery/layer'

const OUTPUT = 'catalogue/catalogue.json'
const TYPES_OUTPUT = 'catalogue/printingTypes.json'

const encodeCatalogue = Schema.encodeEffect(Catalogue.CatalogueJson)
const encodePrintingTypes = Schema.encodeEffect(Catalogue.PrintingTypesJson)

const reportRejectedRecords = Effect.fn('reportRejectedRecords')(function* (
  issues: ReadonlyArray<unknown>,
) {
  yield* Console.error(
    `Rejected ${Array.length(issues)} problem(s); ${OUTPUT} was not written:`,
  )
  yield* Effect.forEach(issues, issue => Console.error(JSON.stringify(issue)))
})

const build = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem

  const { catalogue, printingsNotOnCardTrader } = yield* buildCatalogue.pipe(
    Effect.tapError(error =>
      error._tag === 'RejectedRecords'
        ? reportRejectedRecords(error.issues)
        : Console.error(error.message),
    ),
  )

  const json = yield* encodeCatalogue(catalogue)
  const typesJson = yield* encodePrintingTypes(
    Catalogue.printingTypesOf(catalogue),
  )

  yield* fs.writeFileString(OUTPUT, `${json}\n`)
  yield* fs.writeFileString(TYPES_OUTPUT, `${typesJson}\n`)
  yield* Console.log(
    `Wrote ${Array.length(catalogue.printings)} printings from ${catalogue.source} to ${OUTPUT} and ${TYPES_OUTPUT}`,
  )
  yield* Array.match(printingsNotOnCardTrader, {
    onEmpty: () => Console.log('Every printing has a CardTrader blueprint'),
    onNonEmpty: ids =>
      Console.warn(
        `${Array.length(ids)} printing(s) are not on CardTrader: ${Array.join(ids, ', ')}`,
      ),
  })
})

build.pipe(
  Effect.provide(
    RecordedRiotGallery.pipe(Layer.provideMerge(BunServices.layer)),
  ),
  BunRuntime.runMain,
)
