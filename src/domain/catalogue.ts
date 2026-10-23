import { Array, Order, Schema } from 'effect'

import { Printing, PrintingId } from './printing'

export const Source = Schema.Literals(['RiotGallery'])
export type Source = typeof Source.Type

export const Catalogue = Schema.Struct({
  source: Source,
  printings: Schema.Array(Printing),
})
export type Catalogue = typeof Catalogue.Type

export const CatalogueJson = Schema.fromJsonString(
  Schema.toCodecJson(Catalogue),
)

export const PrintingIds = Schema.Array(PrintingId)
export type PrintingIds = typeof PrintingIds.Type

export const PrintingIdsJson = Schema.fromJsonString(PrintingIds)

export const printingIdsOf = (catalogue: Catalogue): PrintingIds =>
  Array.sort(
    Array.map(catalogue.printings, ({ id }) => id),
    Order.String,
  )
