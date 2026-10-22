import { Match } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { catalogueRouter } from '../../route'
import * as NotFound from '../notFound'
import type { Model } from './model'
import * as Catalogue from './page/catalogue'

export const view = <Message>(model: Model, h: HtmlBuilder<Message>): Html =>
  h.main(
    [h.Class('mx-auto flex max-w-5xl flex-col px-4 py-8')],
    [
      Match.value(model.route).pipe(
        Match.tagsExhaustive({
          Catalogue: () => Catalogue.view(h),
          NotFound: ({ path }) =>
            NotFound.view(
              {
                path,
                backHref: catalogueRouter(),
                backLabel: 'Go to catalogue',
              },
              h,
            ),
        }),
      ),
    ],
  )
