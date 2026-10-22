import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { CatalogueQuery } from '../../domain'
import { AppRoute } from '../../route'
import { ada, allValues } from '../../testing'
import { Message } from './message'
import { CatalogueState, init } from './model'
import * as CataloguePage from './page/catalogue'
import { update } from './update'

const onCatalogue = init(AppRoute.Catalogue(CatalogueQuery.empty), ada)

describe('catalogue loading', () => {
  test('once the index is ready the catalogue page searches', () => {
    story(
      update,
      given(onCatalogue),
      message(Message.AcquiredCatalogueIndex({ allValues })),
      model(next => {
        expect(next.catalogue).toStrictEqual(
          CatalogueState.Ready({ attempt: 0, allValues }),
        )
      }),
      Command.expectExact(CataloguePage.SearchCatalogue),
      Command.resolve(
        CataloguePage.SearchCatalogue,
        CataloguePage.Message.SkippedSearchCatalogue(),
      ),
    )
  })

  test('a failed load can be retried with a new attempt', () => {
    story(
      update,
      given(onCatalogue),
      message(Message.FailedAcquireCatalogueIndex({ reason: 'offline' })),
      model(next => {
        expect(next.catalogue).toStrictEqual(
          CatalogueState.Failed({ attempt: 0 }),
        )
      }),
      message(Message.ClickedRetryCatalogue()),
      model(next => {
        expect(next.catalogue).toStrictEqual(
          CatalogueState.Loading({ attempt: 1 }),
        )
      }),
    )
  })

  test('a search before the index is ready is not started', () => {
    story(
      update,
      given(
        modifyFields(onCatalogue, {
          catalogue: () => CatalogueState.Loading({ attempt: 0 }),
        }),
      ),
      message(Message.ReleasedCatalogueIndex()),
      Command.expectNone(),
    )
  })
})
