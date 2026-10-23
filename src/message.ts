import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest } from 'foldkit/navigation'
import { Url } from 'foldkit/url'

import { Theme } from './domain'
import { LoggedIn, LoggedOut } from './page'

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  ClickedThemeToggle: {},
  ChangedSystemTheme: { theme: Theme.Resolved },
  ClickedSignOut: {},
  ClickedConnectCardTrader: {},
  GotLoggedOutMessage: { message: LoggedOut.Message },
  GotLoggedInMessage: { message: LoggedIn.Message },
  SucceededSignOut: {},
  FailedSignOut: {},
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  CompletedApplyTheme: {},
  CompletedSaveThemePreference: {},
})
export type Message = typeof Message.Type
