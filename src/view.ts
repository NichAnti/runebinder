import { Match } from 'effect'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'

import { APP_NAME } from './constant'
import { CatalogueQuery } from './domain'
import { Message } from './message'
import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import {
  AppRoute,
  cardTraderRouter,
  catalogueHome,
  collectionRouter,
  decksRouter,
} from './route'
import { Button, Link } from './ui'

const title = (route: AppRoute): string =>
  AppRoute.match(route, {
    SignIn: () => `Sign in | ${APP_NAME}`,
    SignUp: () => `Create an account | ${APP_NAME}`,
    Catalogue: () => `Catalogue | ${APP_NAME}`,
    Card: ({ cardId }) => `${cardId} | ${APP_NAME}`,
    CardTrader: () => `CardTrader | ${APP_NAME}`,
    Collection: () => `Collection | ${APP_NAME}`,
    Decks: () => `Decks | ${APP_NAME}`,
    Deck: () => `Deck | ${APP_NAME}`,
    NotFound: () => `Not found | ${APP_NAME}`,
  })

const footerView = (h: HtmlBuilder<Message>): Html =>
  h.footer(
    [h.Class('border-t border-border px-4 py-6 text-xs text-fg-muted')],
    [
      h.p(
        [h.Class('mx-auto max-w-7xl')],
        [
          `${APP_NAME} was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.`,
        ],
      ),
    ],
  )

const navView = (loggedIn: LoggedIn.Model, h: HtmlBuilder<Message>): Html =>
  h.nav(
    [h.AriaLabel('Main'), h.Class('flex items-center gap-2')],
    [
      Link.view(
        {
          href: catalogueHome(),
          content: ['Catalogue'],
          variant: 'Nav',
          isCurrent: loggedIn.route._tag === 'Catalogue',
        },
        h,
      ),
      Link.view(
        {
          href: collectionRouter(CatalogueQuery.empty),
          content: ['Collection'],
          variant: 'Nav',
          isCurrent: loggedIn.route._tag === 'Collection',
        },
        h,
      ),
      Link.view(
        {
          href: decksRouter(),
          content: ['Decks'],
          variant: 'Nav',
          isCurrent:
            loggedIn.route._tag === 'Decks' || loggedIn.route._tag === 'Deck',
        },
        h,
      ),
      Link.view(
        {
          href: cardTraderRouter(),
          content: ['CardTrader'],
          variant: 'Nav',
          isCurrent: loggedIn.route._tag === 'CardTrader',
        },
        h,
      ),
    ],
  )

const accountView = (loggedIn: LoggedIn.Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex items-center gap-3')],
    [
      h.span([h.Class('text-sm text-fg-muted')], [loggedIn.user.name]),
      Button.view(
        {
          content: ['Sign out'],
          variant: 'Secondary',
          onClick: Message.ClickedSignOut(),
        },
        h,
      ),
    ],
  )

const themeToggleView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Button.view(
    {
      content: [`Theme: ${model.themePreference}`],
      variant: 'Secondary',
      onClick: Message.ClickedThemeToggle(),
    },
    h,
  )

const headerView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.header(
    [h.Class('border-b border-border bg-surface')],
    [
      h.div(
        [h.Class('mx-auto flex max-w-5xl items-center gap-6 px-4 py-3')],
        [
          h.span([h.Class('font-semibold')], [APP_NAME]),
          ...Match.value(model.auth).pipe(
            Match.tagsExhaustive({
              LoggedOut: () => [
                h.div([h.Class('ml-auto')], [themeToggleView(model, h)]),
              ],
              LoggedIn: loggedIn => [
                navView(loggedIn, h),
                h.div(
                  [h.Class('ml-auto flex items-center gap-3')],
                  [themeToggleView(model, h), accountView(loggedIn, h)],
                ),
              ],
            }),
          ),
        ],
      ),
    ],
  )

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: title(model.auth.route),
  body: h.div(
    [h.Class('flex min-h-screen flex-col')],
    [
      headerView(model, h),
      Match.value(model.auth).pipe(
        Match.tagsExhaustive({
          LoggedOut: loggedOut =>
            h.submodel({
              slotId: 'logged-out',
              model: loggedOut,
              view: LoggedOut.view,
              toParentMessage: message =>
                Message.GotLoggedOutMessage({ message }),
            }),
          LoggedIn: loggedIn =>
            h.submodel({
              slotId: 'logged-in',
              model: loggedIn,
              view: LoggedIn.view,
              toParentMessage: message =>
                Message.GotLoggedInMessage({ message }),
            }),
        }),
      ),
      footerView(h),
    ],
  ),
})
