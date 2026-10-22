import { Effect, Option, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { type Runtime, Update } from 'foldkit'

import { BrowserKeyValueStore } from '@effect/platform-browser'

import { DARK_COLOR_SCHEME_QUERY, THEME_STORAGE_KEY } from './constant'
import { Theme } from './domain'
import { Message } from './message'
import { Model } from './model'
import { LoggedOut } from './page'
import { AppRoute, urlToAppRoute } from './route'
import { applyTheme, enterRoute } from './update'

// FLAGS

export const Flags = Schema.Struct({
  themePreference: Theme.Preference,
  systemTheme: Theme.Resolved,
})
export type Flags = typeof Flags.Type

const readThemePreference: Effect.Effect<Theme.Preference> = Effect.gen(
  function* () {
    const store = yield* KeyValueStore.KeyValueStore
    const json = yield* Effect.fromOption(
      Option.fromNullishOr(yield* store.get(THEME_STORAGE_KEY)),
    )
    return yield* Schema.decodeEffect(Theme.PreferenceJson)(json)
  },
).pipe(
  Effect.catch(() => Effect.succeed<Theme.Preference>('System')),
  Effect.provide(BrowserKeyValueStore.layerLocalStorage),
)

const readSystemTheme = Effect.sync((): Theme.Resolved =>
  window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches ? 'Dark' : 'Light',
)

export const flags: Effect.Effect<Flags> = Effect.all({
  themePreference: readThemePreference,
  systemTheme: readSystemTheme,
})

// INIT

export const init: Runtime.RoutingApplicationInit<Model, Message, Flags> = (
  flags,
  url,
) =>
  Update.combine(
    Model.make({
      auth: LoggedOut.init(AppRoute.SignIn()),
      themePreference: flags.themePreference,
      systemTheme: flags.systemTheme,
    }),
    [model => enterRoute(model, urlToAppRoute(url)), applyTheme],
  )
