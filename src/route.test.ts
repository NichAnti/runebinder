import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { CatalogueQuery } from './domain'
import { AppRoute, collectionRouter, urlToAppRoute } from './route'

const routeOf = (path: string) =>
  urlToAppRoute({
    protocol: 'https:',
    host: 'example.com',
    port: Option.none(),
    pathname: path,
    search: Option.none(),
    hash: Option.none(),
  })

describe('routes', () => {
  test('/collection is the collection page', () => {
    expect(routeOf('/collection')).toStrictEqual(
      AppRoute.Collection(CatalogueQuery.empty),
    )
    expect(collectionRouter(CatalogueQuery.empty)).toBe('/collection')
  })

  test('/cardtrader is the CardTrader page', () => {
    expect(routeOf('/cardtrader')).toStrictEqual(AppRoute.CardTrader())
  })
})
