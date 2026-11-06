import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'

import { Collection as CollectionDomain, Printing } from '../domain'
import { Authentication } from './authentication'

export class UnknownPrinting extends Schema.TaggedError<UnknownPrinting>()(
  'UnknownPrinting',
  { printingId: Printing.PrintingId },
  { httpApiStatus: 400 },
) {}

export const SetQuantity = Schema.Struct({
  quantity: CollectionDomain.Quantity,
})
export type SetQuantity = typeof SetQuantity.Type

export class Collection extends HttpApiGroup.make('collection')
  .add(
    HttpApiEndpoint.get('list', '/api/collection', {
      success: Schema.Array(CollectionDomain.CollectionItem),
    }),
    HttpApiEndpoint.put('set', '/api/collection/:printingId', {
      params: { printingId: Printing.PrintingId },
      payload: SetQuantity,
      error: UnknownPrinting,
    }),
  )
  .middleware(Authentication) {}
