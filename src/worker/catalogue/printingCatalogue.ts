import { Context, Effect, HashSet, Layer, Schema } from 'effect'

import printingIdsJson from '../../../catalogue/printingIds.json'
import { Catalogue, type Printing } from '../../domain'

export class PrintingCatalogue extends Context.Service<
  PrintingCatalogue,
  { readonly has: (id: Printing.PrintingId) => boolean }
>()('cardtrader/worker/PrintingCatalogue') {
  static readonly layerFrom = (ids: ReadonlyArray<string>) =>
    Layer.effect(
      PrintingCatalogue,
      Effect.gen(function* () {
        const known = HashSet.fromIterable(
          yield* Schema.decodeEffect(Catalogue.PrintingIds)(ids),
        )

        return PrintingCatalogue.of({ has: id => HashSet.has(known, id) })
      }).pipe(Effect.orDie),
    )

  static readonly layer = PrintingCatalogue.layerFrom(printingIdsJson)
}
