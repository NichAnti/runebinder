import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest } from 'foldkit/navigation'
import { Url } from 'foldkit/url'

import { Theme } from './domain'

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  ClickedThemeToggle: {},
  ChangedSystemTheme: { theme: Theme.Resolved },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  CompletedApplyTheme: {},
  CompletedSaveThemePreference: {},
})
export type Message = typeof Message.Type
