import { Schema } from 'effect'
import { defineTaggedUnion, taggedStruct } from 'foldkit/schema'

import { CatalogueQuery, CatalogueSearch, User } from '../../domain'
import { LoggedInRoute } from '../../route'
import * as CardPage from './page/card'
import * as CataloguePage from './page/catalogue'

export const CatalogueState = defineTaggedUnion({
  Loading: { attempt: Schema.Int },
  Ready: { attempt: Schema.Int, allValues: CatalogueSearch.Facets },
  Failed: { attempt: Schema.Int },
})
export type CatalogueState = typeof CatalogueState.Type

export const Model = taggedStruct('LoggedIn', {
  route: LoggedInRoute,
  user: User.User,
  catalogue: CatalogueState,
  cataloguePage: CataloguePage.Model,
  cardPage: CardPage.Model,
})
export type Model = typeof Model.Type

export const init = (route: LoggedInRoute, user: User.User): Model =>
  Model({
    route,
    user,
    catalogue: CatalogueState.Loading({ attempt: 0 }),
    cataloguePage: CataloguePage.init(
      route._tag === 'Catalogue' ? route : CatalogueQuery.empty,
    ),
    cardPage: CardPage.init(),
  })
