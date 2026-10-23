import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { CatalogueQuery, Printing } from '../../domain'
import { AppRoute } from '../../route'
import { ada, allValues, testCard } from '../../testing'
import * as CollectionState from './collection'
import { Message } from './message'
import { CatalogueState, init } from './model'
import * as CardPage from './page/card'
import * as CataloguePage from './page/catalogue'
import { enterRoute, update } from './update'

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
      Command.expectExact(
        CataloguePage.SearchCatalogue,
        CollectionState.LoadCollection,
      ),
      Command.resolve(
        CataloguePage.SearchCatalogue,
        CataloguePage.Message.SkippedSearchCatalogue(),
      ),
      Command.resolve(
        CollectionState.LoadCollection,
        CollectionState.Message.SucceededLoadCollection({ items: [] }),
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

describe('collection on the card page', () => {
  const onCard = modifyFields(
    init(AppRoute.Card({ cardId: testCard.id, printing: Option.none() }), ada),
    { catalogue: () => CatalogueState.Ready({ attempt: 0, allValues }) },
  )
  const printingId = Printing.PrintingId.make('tst-001-010')

  test('opening a card loads the collection once', () => {
    const entered = enterRoute(
      onCard,
      AppRoute.Card({ cardId: testCard.id, printing: Option.none() }),
    )

    expect(entered.model.collection).toStrictEqual(
      CollectionState.Model.Loading(),
    )
    expect(entered.commands?.map(({ name }) => name)).toContain(
      CollectionState.LoadCollection.name,
    )
  })

  test('a step on the card page becomes a pending save', () => {
    story(
      update,
      given(
        modifyFields(onCard, {
          collection: () =>
            CollectionState.Model.Ready({
              owned: {},
              saves: {},
              nextRevision: 0,
              refresh: CollectionState.Refresh.Idle(),
            }),
        }),
      ),
      message(
        Message.GotCardPageMessage({
          message: CardPage.Message.ClickedStepQuantity({
            printingId,
            step: 1,
          }),
        }),
      ),
      model(next => {
        expect(
          next.collection._tag === 'Ready' && next.collection.owned[printingId],
        ).toBe(1)
      }),
      Command.expectExact(CollectionState.WaitToSave),
      Command.resolve(
        CollectionState.WaitToSave,
        CollectionState.Message.ElapsedSaveDelay({ printingId, revision: 0 }),
      ),
      Command.resolve(
        CollectionState.SaveQuantity,
        CollectionState.Message.SucceededSaveQuantity({
          printingId,
          revision: 0,
        }),
      ),
    )
  })
})

describe('collection and the ownership filter', () => {
  test('an Owned search waits for the collection, then runs', () => {
    const ownedRoute = AppRoute.Catalogue({
      ...CatalogueQuery.empty,
      ownership: 'Owned',
    })
    const onOwned = modifyFields(init(ownedRoute, ada), {
      catalogue: () => CatalogueState.Ready({ attempt: 0, allValues }),
    })
    const entered = enterRoute(onOwned, ownedRoute)

    expect(entered.commands?.map(({ name }) => name)).toStrictEqual([
      CollectionState.LoadCollection.name,
    ])

    story(
      update,
      given(entered.model),
      message(
        Message.GotCollectionMessage({
          message: CollectionState.Message.SucceededLoadCollection({
            items: [],
          }),
        }),
      ),
      Command.expectExact(CataloguePage.SearchCatalogue),
      Command.resolve(
        CataloguePage.SearchCatalogue,
        CataloguePage.Message.SkippedSearchCatalogue(),
      ),
    )
  })
})
