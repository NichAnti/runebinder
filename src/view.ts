import { Match } from 'effect'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'

import { APP_NAME } from './constant'
import { Message } from './message'
import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import {
  AppRoute,
  cardTraderRouter,
  catalogueHome,
  decksRouter,
  homeRouter,
  signInRouter,
  wishlistsRouter,
} from './route'
import { Button, Icon, IconButton, Link } from './ui'

const title = (route: AppRoute): string =>
  AppRoute.match(route, {
    Home: () => APP_NAME,
    SignIn: () => `Sign in | ${APP_NAME}`,
    SignUp: () => `Create an account | ${APP_NAME}`,
    Catalogue: () => `Cards | ${APP_NAME}`,
    Card: ({ cardId }) => `${cardId} | ${APP_NAME}`,
    CardTrader: () => `CardTrader | ${APP_NAME}`,
    Decks: () => `Decks | ${APP_NAME}`,
    Deck: () => `Deck | ${APP_NAME}`,
    Wishlists: () => `Wishlists | ${APP_NAME}`,
    CustomWishlist: () => `Custom wishlist | ${APP_NAME}`,
    DeckWishlist: () => `Deck wishlist | ${APP_NAME}`,
    CardTraderWishlist: () => `CardTrader wishlist | ${APP_NAME}`,
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
    [
      h.AriaLabel('Main'),
      h.Class(
        'order-last flex w-full items-center gap-2 overflow-x-auto sm:order-none sm:w-auto',
      ),
    ],
    [
      Link.view(
        {
          href: catalogueHome(),
          content: ['Cards'],
          variant: 'Nav',
          isCurrent: loggedIn.route._tag === 'Catalogue',
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
          href: wishlistsRouter(),
          content: ['Wishlists'],
          variant: 'Nav',
          isCurrent:
            loggedIn.route._tag === 'Wishlists' ||
            loggedIn.route._tag === 'CustomWishlist' ||
            loggedIn.route._tag === 'DeckWishlist' ||
            loggedIn.route._tag === 'CardTraderWishlist',
        },
        h,
      ),
    ],
  )

const cardTraderStatusView = (
  loggedIn: LoggedIn.Model,
  h: HtmlBuilder<Message>,
): Html =>
  loggedIn.cardTrader.connection._tag === 'Connected'
    ? Link.view(
        {
          href: cardTraderRouter(),
          content: [
            h.span([h.Class('sm:hidden')], ['CardTrader']),
            h.span([h.Class('hidden sm:inline')], ['CardTrader: connected']),
          ],
          variant: 'Nav',
          isCurrent: loggedIn.route._tag === 'CardTrader',
        },
        h,
      )
    : h.div(
        [],
        [
          h.div(
            [h.Class('sm:hidden')],
            [
              IconButton.view(
                {
                  icon: 'LockClosed',
                  label: 'Connect CardTrader',
                  action: {
                    _tag: 'Click',
                    message: Message.ClickedConnectCardTrader(),
                  },
                },
                h,
              ),
            ],
          ),
          h.div(
            [h.Class('hidden sm:block')],
            [
              Button.view(
                {
                  content: [
                    Icon.view({ name: 'LockClosed', size: 'Small' }),
                    'Connect CardTrader',
                  ],
                  variant: 'Secondary',
                  onClick: Message.ClickedConnectCardTrader(),
                },
                h,
              ),
            ],
          ),
        ],
      )

const accountView = (loggedIn: LoggedIn.Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex items-center gap-3')],
    [
      h.span(
        [h.Class('hidden text-sm text-fg-muted md:inline')],
        [loggedIn.user.name],
      ),
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
        [
          h.Class(
            'mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3',
          ),
        ],
        [
          h.a(
            [
              h.Href(
                model.auth._tag === 'LoggedIn' ? catalogueHome() : homeRouter(),
              ),
              h.Class(
                'rounded-control font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              ),
            ],
            [APP_NAME],
          ),
          ...Match.value(model.auth).pipe(
            Match.tagsExhaustive({
              LoggedOut: loggedOut => [
                h.div(
                  [h.Class('ml-auto flex items-center gap-2 sm:gap-3')],
                  [
                    ...(loggedOut.route._tag === 'SignIn'
                      ? []
                      : [
                          Link.view(
                            {
                              href: signInRouter(),
                              content: ['Sign in'],
                              variant: 'Nav',
                            },
                            h,
                          ),
                        ]),
                    themeToggleView(model, h),
                  ],
                ),
              ],
              LoggedIn: loggedIn => [
                navView(loggedIn, h),
                h.div(
                  [h.Class('ml-auto flex items-center gap-2 sm:gap-3')],
                  [
                    cardTraderStatusView(loggedIn, h),
                    themeToggleView(model, h),
                    accountView(loggedIn, h),
                  ],
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
