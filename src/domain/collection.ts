import { Option, Schema } from 'effect'

import { PrintingId } from './printing'

export const MAX_QUANTITY = 999

export const Quantity = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: MAX_QUANTITY }),
).pipe(Schema.brand('Quantity'))
export type Quantity = typeof Quantity.Type

export const OwnedQuantity = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: MAX_QUANTITY }),
).pipe(Schema.brand('OwnedQuantity'))
export type OwnedQuantity = typeof OwnedQuantity.Type

export const CollectionItem = Schema.Struct({
  printingId: PrintingId,
  quantity: OwnedQuantity,
})
export type CollectionItem = typeof CollectionItem.Type

export const toOwned = (quantity: Quantity): Option.Option<OwnedQuantity> =>
  Schema.decodeOption(OwnedQuantity)(quantity)
