import { Schema } from 'effect'

import { Printing } from './printing'

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
