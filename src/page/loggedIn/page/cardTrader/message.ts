import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CardTraderFailure } from '../../../../service'

export const Message = defineMessageUnion({
  UpdatedToken: { value: Schema.Redacted(Schema.String) },
  ToggledRemember: { isChecked: Schema.Boolean },
  SubmittedConnect: {},
  ClickedDisconnect: {},
  FoundNoStoredToken: {},
  SucceededCheckStoredToken: {
    appName: Schema.String,
    isRemembered: Schema.Boolean,
  },
  FailedCheckStoredToken: { reason: CardTraderFailure },
  SucceededConnectCardTrader: {
    appName: Schema.String,
    isRemembered: Schema.Boolean,
  },
  FailedConnectCardTrader: { reason: CardTraderFailure },
  CompletedForgetCardTraderToken: {},
})
export type Message = typeof Message.Type
