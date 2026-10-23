import { Effect, Option, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { type Runtime, Update } from 'foldkit'

import { BrowserKeyValueStore } from '@effect/platform-browser'

import { DARK_COLOR_SCHEME_QUERY, THEME_STORAGE_KEY } from './constant'
import { CatalogueQuery, Theme, User } from './domain'
import { Message } from './message'
import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import { AppRoute, urlToAppRoute } from './route'
import {
  ApiClient,
  type AuthClient,
  type CardTraderClient,
  type CatalogueIndexService,
  type TokenStore,
} from './service'
import { applyTheme, enterRoute } from './update'

// FLAGS

export const Flags = Schema.Struct({
  themePreference: Theme.Preference,
  systemTheme: Theme.Resolved,
  maybeUser: Schema.Option(User.User),
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

const readCurrentUser: Effect.Effect<Option.Option<User.User>> = Effect.gen(
  function* () {
    const api = yield* ApiClient
    const user = yield* api.account.me()
    return Option.some(user)
  },
).pipe(
  Effect.catch(() => Effect.succeed(Option.none<User.User>())),
  Effect.provide(ApiClient.layer),
)

export const flags: Effect.Effect<Flags> = Effect.all({
  themePreference: readThemePreference,
  systemTheme: readSystemTheme,
  maybeUser: readCurrentUser,
})

// INIT

export const init: Runtime.RoutingApplicationInit<
  Model,
  Message,
  Flags,
  ApiClient | AuthClient | CardTraderClient | CatalogueIndexService | TokenStore
> = (flags, url) =>
  Update.combine(
    Model.make({
      auth: Option.match(flags.maybeUser, {
        onNone: () => LoggedOut.init(AppRoute.SignIn()),
        onSome: user =>
          LoggedIn.init(AppRoute.Catalogue(CatalogueQuery.empty), user),
      }),
      themePreference: flags.themePreference,
      systemTheme: flags.systemTheme,
    }),
    [model => enterRoute(model, urlToAppRoute(url)), applyTheme],
  )
