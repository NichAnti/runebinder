import { Schema } from 'effect'

import { LoggedIn, LoggedOut } from './page'

export const Model = Schema.Struct({
  auth: Schema.Union([LoggedOut.Model, LoggedIn.Model]),
})
export type Model = typeof Model.Type
