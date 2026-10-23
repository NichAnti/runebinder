import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { HoverIntent } from '@foldkit/ui'

import { Printing } from '../../../domain'
import { Step } from '../collection'

export const Message = defineMessageUnion({
  GotHoverIntentMessage: {
    cardId: Printing.CardId,
    message: HoverIntent.Message,
  },
  ClickedTrigger: { cardId: Printing.CardId },
  ClickedDismiss: {},
  SucceededLoadPanelCard: {
    cardId: Printing.CardId,
    maybeCard: Schema.Option(Printing.Card),
  },
  SkippedLoadPanelCard: {},
  CompletedAnchorCardPanel: {},
  ClickedStepQuantity: { printingId: Printing.PrintingId, step: Step },
  ClickedRetryCollection: {},
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  SteppedQuantity: { printingId: Printing.PrintingId, step: Step },
  RequestedCollectionRetry: {},
})
export type OutMessage = typeof OutMessage.Type
