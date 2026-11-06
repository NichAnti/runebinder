import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CardTraderFailure } from '../../../service'
import { Dialog } from '../../../ui'

export const Message = defineMessageUnion({
  FoundStoredToken: { isRemembered: Schema.Boolean },
  FoundNoStoredToken: {},
  SucceededCheckToken: { appName: Schema.String },
  FailedCheckToken: { reason: CardTraderFailure },
  ClickedConnect: {},
  ClickedDisconnect: {},
  UpdatedToken: { value: Schema.Redacted(Schema.String) },
  ToggledRemember: { isChecked: Schema.Boolean },
  SubmittedConnect: {},
  SucceededConnectCardTrader: {
    appName: Schema.String,
    isRemembered: Schema.Boolean,
  },
  FailedConnectCardTrader: { reason: CardTraderFailure },
  CompletedForgetCardTraderToken: {},
  GotDialogMessage: { message: Dialog.Message },
})
export type Message = typeof Message.Type
