import { Effect, Match, Option, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { Command, Update } from 'foldkit'
import { UrlRequest, load, pushUrl, replaceUrl } from 'foldkit/navigation'
import { modifyFields } from 'foldkit/struct'
import { toString as urlToString } from 'foldkit/url'

import { BrowserKeyValueStore } from '@effect/platform-browser'

import { THEME_STORAGE_KEY } from './constant'
import { CatalogueQuery, Theme } from './domain'
import { Message } from './message'
import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import {
  AppRoute,
  type LoggedInRoute,
  catalogueHome,
  signInRouter,
  urlToAppRoute,
} from './route'
import {
  type ApiClient,
  AuthClient,
  type CardTraderClient,
  type CatalogueIndexService,
  TokenStore,
} from './service'

type UpdateReturn = Update.Return<
  Model,
  Message,
  ApiClient | AuthClient | CardTraderClient | CatalogueIndexService | TokenStore
>
const withUpdateReturn = Match.withReturnType<UpdateReturn>()

// COMMAND

export const NavigateInternal = Command.define('NavigateInternal', {
  args: { url: Schema.String },
  messages: [Message.CompletedNavigateInternal],
  execute: ({ url }) =>
    pushUrl(url).pipe(Effect.as(Message.CompletedNavigateInternal())),
})

const LoadExternal = Command.define('LoadExternal', {
  args: { href: Schema.String },
  messages: [Message.CompletedLoadExternal],
  execute: ({ href }) =>
    load(href).pipe(Effect.as(Message.CompletedLoadExternal())),
})

export const RedirectToSignIn = Command.define('RedirectToSignIn', {
  messages: [Message.CompletedNavigateInternal],
  execute: replaceUrl(signInRouter()).pipe(
    Effect.as(Message.CompletedNavigateInternal()),
  ),
})

export const RedirectToCatalogue = Command.define('RedirectToCatalogue', {
  messages: [Message.CompletedNavigateInternal],
  execute: replaceUrl(catalogueHome()).pipe(
    Effect.as(Message.CompletedNavigateInternal()),
  ),
})

export const ApplyTheme = Command.define('ApplyTheme', {
  args: { theme: Theme.Resolved },
  messages: [Message.CompletedApplyTheme],
  execute: ({ theme }) =>
    Effect.sync(() => {
      document.documentElement.classList.toggle('dark', theme === 'Dark')
      return Message.CompletedApplyTheme()
    }),
})

export const SaveThemePreference = Command.define('SaveThemePreference', {
  args: { preference: Theme.Preference },
  messages: [Message.CompletedSaveThemePreference],
  execute: ({ preference }) =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore
      const json = yield* Schema.encodeEffect(Theme.PreferenceJson)(preference)
      yield* store.set(THEME_STORAGE_KEY, json)
      return Message.CompletedSaveThemePreference()
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(Message.CompletedSaveThemePreference()),
      ),
      Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    ),
})

export const SignOut = Command.define('SignOut', {
  messages: [Message.SucceededSignOut, Message.FailedSignOut],
  execute: Effect.gen(function* () {
    const auth = yield* AuthClient
    const tokenStore = yield* TokenStore
    yield* tokenStore.clear
    yield* auth.signOut
    return Message.SucceededSignOut()
  }).pipe(Effect.catch(() => Effect.succeed(Message.FailedSignOut()))),
})

// UPDATE

const foldLoggedOutOutMessage = LoggedOut.OutMessage.match<
  Update.Step<Model, Message>
>({
  SignedIn:
    ({ user }) =>
    model => ({
      model: modifyFields(model, {
        auth: () =>
          LoggedIn.init(AppRoute.Catalogue(CatalogueQuery.empty), user),
      }),
      commands: [RedirectToCatalogue()],
    }),
})

const foldLoggedOut = Update.foldChild({
  update: LoggedOut.update,
  read: (model: Model) =>
    Match.value(model.auth).pipe(
      Match.tagsExhaustive({
        LoggedOut: loggedOut => Option.some(loggedOut),
        LoggedIn: () => Option.none(),
      }),
    ),
  write: (model, nextLoggedOut) =>
    modifyFields(model, { auth: () => nextLoggedOut }),
  toParentMessage: message => Message.GotLoggedOutMessage({ message }),
  foldOutMessage: foldLoggedOutOutMessage,
})

const readLoggedIn = (model: Model) =>
  Match.value(model.auth).pipe(
    Match.tagsExhaustive({
      LoggedOut: () => Option.none(),
      LoggedIn: loggedIn => Option.some(loggedIn),
    }),
  )

const writeLoggedIn = (model: Model, nextLoggedIn: LoggedIn.Model): Model =>
  modifyFields(model, { auth: () => nextLoggedIn })

const toLoggedInMessage = (message: LoggedIn.Message): Message =>
  Message.GotLoggedInMessage({ message })

const foldLoggedIn = Update.foldChild({
  update: LoggedIn.update,
  read: readLoggedIn,
  write: writeLoggedIn,
  toParentMessage: toLoggedInMessage,
})

const openCardTraderConnect = Update.foldChildStep({
  update: LoggedIn.openConnect,
  read: readLoggedIn,
  write: writeLoggedIn,
  toParentMessage: toLoggedInMessage,
})

const foldLoggedInRoute = Update.foldChild({
  update: LoggedIn.enterRoute,
  read: readLoggedIn,
  write: writeLoggedIn,
  toParentMessage: toLoggedInMessage,
})

const resolvedTheme = (model: Model): Theme.Resolved =>
  Theme.resolve(model.themePreference, model.systemTheme)

export const applyTheme: Update.Step<Model, Message> = model => ({
  model,
  commands: [ApplyTheme({ theme: resolvedTheme(model) })],
})

export const enterRoute = (model: Model, route: AppRoute): UpdateReturn =>
  Match.value(model.auth).pipe(
    withUpdateReturn,
    Match.tagsExhaustive({
      LoggedOut: loggedOut =>
        Match.value(route).pipe(
          withUpdateReturn,
          Match.tag('SignIn', 'SignUp', 'NotFound', route => ({
            model: modifyFields(model, {
              auth: () => modifyFields(loggedOut, { route: () => route }),
            }),
          })),
          Match.orElse(() => ({ model, commands: [RedirectToSignIn()] })),
        ),
      LoggedIn: () =>
        Match.value(route).pipe(
          withUpdateReturn,
          Match.tag(
            'Catalogue',
            'Card',
            'CardTrader',
            'Decks',
            'Deck',
            'Wishlists',
            'CustomWishlist',
            'DeckWishlist',
            'CardTraderWishlist',
            'NotFound',
            (route: LoggedInRoute) => foldLoggedInRoute(model, route),
          ),
          Match.orElse(() => ({ model, commands: [RedirectToCatalogue()] })),
        ),
    }),
  )

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    ClickedLink: ({ request }) =>
      UrlRequest.match<UpdateReturn>(request, {
        Internal: ({ url }) => ({
          model,
          commands: [NavigateInternal({ url: urlToString(url) })],
        }),
        External: ({ href }) => ({
          model,
          commands: [LoadExternal({ href })],
        }),
      }),
    ChangedUrl: ({ url }) => enterRoute(model, urlToAppRoute(url)),
    ClickedThemeToggle: () => {
      const nextModel = modifyFields(model, { themePreference: Theme.next })

      return {
        model: nextModel,
        commands: [
          ApplyTheme({ theme: resolvedTheme(nextModel) }),
          SaveThemePreference({ preference: nextModel.themePreference }),
        ],
      }
    },
    ChangedSystemTheme: ({ theme }) =>
      applyTheme(modifyFields(model, { systemTheme: () => theme })),
    ClickedSignOut: () => ({ model, commands: [SignOut()] }),
    ClickedConnectCardTrader: () => openCardTraderConnect(model),
    GotLoggedOutMessage: ({ message }) => foldLoggedOut(model, message),
    GotLoggedInMessage: ({ message }) => foldLoggedIn(model, message),
    SucceededSignOut: () => ({
      model: modifyFields(model, {
        auth: () => LoggedOut.init(AppRoute.SignIn()),
      }),
      commands: [RedirectToSignIn()],
    }),
    FailedSignOut: () => ({ model }),
    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),
    CompletedApplyTheme: () => ({ model }),
    CompletedSaveThemePreference: () => ({ model }),
  })
