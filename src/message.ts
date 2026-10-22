import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest } from 'foldkit/navigation'
import { Url } from 'foldkit/url'

import { Theme } from './domain'
import { LoggedOut } from './page'

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  ClickedThemeToggle: {},
  ChangedSystemTheme: { theme: Theme.Resolved },
  ClickedSignOut: {},
  GotLoggedOutMessage: { message: LoggedOut.Message },
  SucceededSignOut: {},
  FailedSignOut: {},
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  CompletedApplyTheme: {},
  CompletedSaveThemePreference: {},
})
export type Message = typeof Message.Type
