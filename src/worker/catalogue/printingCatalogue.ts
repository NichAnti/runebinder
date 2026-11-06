import { RuntimeContext } from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import { Context, Effect, Layer, Option, Record, Schema } from 'effect'

import { CATALOGUE_VERSION, printingTypesKey } from '../../api'
import { Catalogue, type Printing } from '../../domain'
import { CardDataBucket } from '../cardData'

export type PrintingIndex = Readonly<{
  find: (id: Printing.PrintingId) => Option.Option<Printing.KnownPrinting>
  has: (id: Printing.PrintingId) => boolean
}>

const indexOf = (types: Catalogue.PrintingTypes): PrintingIndex => {
  const find = (id: Printing.PrintingId) =>
    Option.map(Record.get(types, id), maybeType => ({
      printingId: id,
      maybeType,
    }))

  return { find, has: id => Option.isSome(find(id)) }
}

export class PrintingCatalogue extends Context.Service<
  PrintingCatalogue,
  { readonly index: Effect.Effect<PrintingIndex> }
>()('runebinder/worker/PrintingCatalogue') {
  static readonly layerFrom = (json: unknown) =>
    Layer.effect(
      PrintingCatalogue,
      Schema.decodeUnknownEffect(Catalogue.PrintingTypes)(json).pipe(
        Effect.map(types =>
          PrintingCatalogue.of({ index: Effect.succeed(indexOf(types)) }),
        ),
        Effect.orDie,
      ),
    )

  // Read from the card data bucket on first use and kept for the life of the
  // Worker instance. A missing catalogue means the deploy did not seed it.
  /** @effect-expect-leaking RuntimeContext */
  static readonly layer = Layer.effect(
    PrintingCatalogue,
    Effect.gen(function* () {
      const bucket = yield* Cloudflare.R2.ReadBucket(yield* CardDataBucket)
      const index = yield* Effect.cached(
        Effect.gen(function* () {
          const key = printingTypesKey(CATALOGUE_VERSION)
          const object = yield* bucket.get(key)

          if (object === null) {
            return yield* Effect.die(`The card data bucket has no ${key}`)
          }

          const types = yield* object
            .text()
            .pipe(
              Effect.flatMap(
                Schema.decodeUnknownEffect(Catalogue.PrintingTypesJson),
              ),
            )
          return indexOf(types)
        }).pipe(Effect.orDie, Effect.provide(RuntimeContext.phantom)),
      )

      return PrintingCatalogue.of({ index })
    }),
  ).pipe(Layer.provide(Cloudflare.R2.ReadBucketBinding))
}
