import { Schema } from 'effect'

import { Theme } from './domain'
import { LoggedIn, LoggedOut } from './page'

export const Model = Schema.Struct({
  auth: Schema.Union([LoggedOut.Model, LoggedIn.Model]),
  themePreference: Theme.Preference,
  systemTheme: Theme.Resolved,
})
export type Model = typeof Model.Type
