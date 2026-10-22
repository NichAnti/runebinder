import { Match } from 'effect'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'

import { APP_NAME } from './constant'
import { Message } from './message'
import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import { AppRoute, catalogueRouter } from './route'
import { Button, Link } from './ui'

const title = (route: AppRoute): string =>
  AppRoute.match(route, {
    SignIn: () => `Sign in | ${APP_NAME}`,
    Catalogue: () => `Catalogue | ${APP_NAME}`,
    NotFound: () => `Not found | ${APP_NAME}`,
  })

const navView = (auth: Model['auth'], h: HtmlBuilder<Message>): Html =>
  Match.value(auth).pipe(
    Match.tagsExhaustive({
      LoggedOut: () => h.empty,
      LoggedIn: loggedIn =>
        h.nav(
          [h.AriaLabel('Main'), h.Class('flex items-center gap-2')],
          [
            Link.view(
              {
                href: catalogueRouter(),
                content: ['Catalogue'],
                variant: 'Nav',
                isCurrent: loggedIn.route._tag === 'Catalogue',
              },
              h,
            ),
          ],
        ),
    }),
  )

const headerView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.header(
    [h.Class('border-b border-border bg-surface')],
    [
      h.div(
        [h.Class('mx-auto flex max-w-5xl items-center gap-6 px-4 py-3')],
        [
          h.span([h.Class('font-semibold')], [APP_NAME]),
          navView(model.auth, h),
          h.div(
            [h.Class('ml-auto')],
            [
              Button.view(
                {
                  content: [`Theme: ${model.themePreference}`],
                  variant: 'Secondary',
                  onClick: Message.ClickedThemeToggle(),
                },
                h,
              ),
            ],
          ),
        ],
      ),
    ],
  )

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: title(model.auth.route),
  body: h.div(
    [h.Class('min-h-screen')],
    [
      headerView(model, h),
      Match.value(model.auth).pipe(
        Match.tagsExhaustive({
          LoggedOut: loggedOut => LoggedOut.view(loggedOut, h),
          LoggedIn: loggedIn => LoggedIn.view(loggedIn, h),
        }),
      ),
    ],
  ),
})
