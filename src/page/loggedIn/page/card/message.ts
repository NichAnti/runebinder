import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Printing } from '../../../../domain'
import { Step } from '../../collection'

export const Message = defineMessageUnion({
  SucceededLoadCard: {
    cardId: Printing.CardId,
    maybeCard: Schema.Option(Printing.Card),
  },
  SkippedLoadCard: {},
  ClickedStepQuantity: { printingId: Printing.PrintingId, step: Step },
  ClickedRetryCollection: {},
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  SteppedQuantity: { printingId: Printing.PrintingId, step: Step },
  RequestedCollectionRetry: {},
})
export type OutMessage = typeof OutMessage.Type
