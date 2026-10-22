import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Printing } from '../../../../domain'

export const Message = defineMessageUnion({
  SucceededLoadCard: {
    cardId: Printing.CardId,
    maybeCard: Schema.Option(Printing.Card),
  },
  SkippedLoadCard: {},
})
export type Message = typeof Message.Type
