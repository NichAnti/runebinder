import { Match } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { signInRouter } from '../../route'
import * as NotFound from '../notFound'
import type { Model } from './model'
import * as SignIn from './page/signIn'

export const view = <Message>(model: Model, h: HtmlBuilder<Message>): Html =>
  h.main(
    [h.Class('mx-auto flex max-w-md flex-col px-4 py-16')],
    [
      Match.value(model.route).pipe(
        Match.tagsExhaustive({
          SignIn: () => SignIn.view(h),
          NotFound: ({ path }) =>
            NotFound.view(
              { path, backHref: signInRouter(), backLabel: 'Go to sign in' },
              h,
            ),
        }),
      ),
    ],
  )
