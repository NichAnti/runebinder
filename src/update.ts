import { Effect, Match, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { Command, type Update } from 'foldkit'
import { UrlRequest, load, pushUrl, replaceUrl } from 'foldkit/navigation'
import { modifyFields } from 'foldkit/struct'
import { toString as urlToString } from 'foldkit/url'

import { BrowserKeyValueStore } from '@effect/platform-browser'

import { THEME_STORAGE_KEY } from './constant'
import { Theme } from './domain'
import { Message } from './message'
import { Model } from './model'
import {
  type AppRoute,
  catalogueRouter,
  signInRouter,
  urlToAppRoute,
} from './route'

type UpdateReturn = Update.Return<Model, Message>
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
  execute: replaceUrl(catalogueRouter()).pipe(
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

// UPDATE

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
          Match.tag('SignIn', 'NotFound', route => ({
            model: modifyFields(model, {
              auth: () => modifyFields(loggedOut, { route: () => route }),
            }),
          })),
          Match.orElse(() => ({ model, commands: [RedirectToSignIn()] })),
        ),
      LoggedIn: loggedIn =>
        Match.value(route).pipe(
          withUpdateReturn,
          Match.tag('Catalogue', 'NotFound', route => ({
            model: modifyFields(model, {
              auth: () => modifyFields(loggedIn, { route: () => route }),
            }),
          })),
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
    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),
    CompletedApplyTheme: () => ({ model }),
    CompletedSaveThemePreference: () => ({ model }),
  })
