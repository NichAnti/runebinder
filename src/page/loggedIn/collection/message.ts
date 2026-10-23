import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Collection, Printing } from '../../../domain'

export const Message = defineMessageUnion({
  SucceededLoadCollection: {
    items: Schema.Array(Collection.CollectionItem),
  },
  FailedLoadCollection: {},
  ClickedRetryLoadCollection: {},
  ElapsedSaveDelay: {
    printingId: Printing.PrintingId,
    revision: Schema.Int,
  },
  SucceededSaveQuantity: {
    printingId: Printing.PrintingId,
    revision: Schema.Int,
  },
  FailedSaveQuantity: {
    printingId: Printing.PrintingId,
    revision: Schema.Int,
  },
  ClickedRetrySaves: {},
})
export type Message = typeof Message.Type
