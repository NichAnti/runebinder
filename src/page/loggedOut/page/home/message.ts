import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Printing } from '../../../../domain'

export const Message = defineMessageUnion({
  SucceededLoadShowcase: { printings: Schema.Array(Printing.Printing) },
  FailedLoadShowcase: {},
})
export type Message = typeof Message.Type
