import { Match } from 'effect'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'

import { APP_NAME } from './constant'
import { Message } from './message'
import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import { AppRoute, catalogueRouter } from './route'

const title = (route: AppRoute): string =>
  AppRoute.match(route, {
    SignIn: () => `Sign in | ${APP_NAME}`,
    Catalogue: () => `Catalogue | ${APP_NAME}`,
    NotFound: () => `Not found | ${APP_NAME}`,
  })

const headerView = (h: HtmlBuilder<Message>): Html =>
  h.header(
    [h.Class('border-b border-border bg-surface')],
    [
      h.div(
        [
          h.Class(
            'mx-auto flex max-w-5xl items-center justify-between px-4 py-3',
          ),
        ],
        [
          h.a(
            [h.Href(catalogueRouter()), h.Class('font-semibold')],
            [APP_NAME],
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
      headerView(h),
      Match.value(model.auth).pipe(
        Match.tagsExhaustive({
          LoggedOut: loggedOut => LoggedOut.view(loggedOut, h),
          LoggedIn: loggedIn => LoggedIn.view(loggedIn, h),
        }),
      ),
    ],
  ),
})
