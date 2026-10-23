import { Context, Effect, Layer, Option, Record, Schema } from 'effect'

import printingTypesJson from '../../../catalogue/printingTypes.json'
import { Catalogue, type DeckCode, type Printing } from '../../domain'

export class PrintingCatalogue extends Context.Service<
  PrintingCatalogue,
  {
    readonly find: (
      id: Printing.PrintingId,
    ) => Option.Option<DeckCode.KnownPrinting>
    readonly has: (id: Printing.PrintingId) => boolean
  }
>()('cardtrader/worker/PrintingCatalogue') {
  static readonly layerFrom = (json: unknown) =>
    Layer.effect(
      PrintingCatalogue,
      Effect.gen(function* () {
        const types = yield* Schema.decodeUnknownEffect(
          Catalogue.PrintingTypes,
        )(json)
        const find = (id: Printing.PrintingId) =>
          Option.map(Record.get(types, id), maybeType => ({
            printingId: id,
            maybeType,
          }))

        return PrintingCatalogue.of({
          find,
          has: id => Option.isSome(find(id)),
        })
      }).pipe(Effect.orDie),
    )

  static readonly layer = PrintingCatalogue.layerFrom(printingTypesJson)
}
