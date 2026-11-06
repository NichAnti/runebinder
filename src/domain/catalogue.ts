import { Array, Order, Record, Schema } from 'effect'

import { CardType, Printing, PrintingId } from './printing'

export const Source = Schema.Literals(['RiotGallery'])
export type Source = typeof Source.Type

const byId = Order.mapInput(Order.String, ({ id }: Printing) => id)

export const Catalogue = Schema.Struct({
  source: Source,
  printings: Schema.Array(Printing),
})
export type Catalogue = typeof Catalogue.Type

export const CatalogueJson = Schema.fromJsonString(
  Schema.toCodecJson(Catalogue),
)

export const PrintingTypes = Schema.Record(
  PrintingId,
  Schema.OptionFromNullOr(CardType),
)
export type PrintingTypes = typeof PrintingTypes.Type

export const PrintingTypesJson = Schema.fromJsonString(PrintingTypes)

export const printingTypesOf = (catalogue: Catalogue): PrintingTypes =>
  Record.fromEntries(
    Array.map(Array.sort(catalogue.printings, byId), ({ id, maybeType }) => [
      id,
      maybeType,
    ]),
  )
