import { Effect, Match, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { UrlRequest, load, pushUrl, replaceUrl } from 'foldkit/navigation'
import { modifyFields } from 'foldkit/struct'
import { toString as urlToString } from 'foldkit/url'

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

// UPDATE

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
    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),
  })
