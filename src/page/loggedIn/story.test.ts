import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { CatalogueQuery, Collection, Deck, Printing } from '../../domain'
import { AppRoute } from '../../route'
import { ada, allValues, testCard } from '../../testing'
import * as CollectionState from './collection'
import * as DecksState from './decks'
import { Message } from './message'
import { CatalogueState, init } from './model'
import * as CardPage from './page/card'
import * as CataloguePage from './page/catalogue'
import * as DeckPage from './page/deck'
import * as DeckListPage from './page/deckList'
import { OpenDeck, enterRoute, update } from './update'
import * as WishlistState from './wishlist'

const onCatalogue = init(AppRoute.Catalogue(CatalogueQuery.empty), ada)

describe('catalogue loading', () => {
  test('once the index is ready the catalogue page searches', () => {
    story(
      update,
      given(onCatalogue),
      message(Message.AcquiredCatalogueIndex({ allValues, printingSets: {} })),
      model(next => {
        expect(next.catalogue).toStrictEqual(
          CatalogueState.Ready({ attempt: 0, allValues, printingSets: {} }),
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
    {
      catalogue: () =>
        CatalogueState.Ready({ attempt: 0, allValues, printingSets: {} }),
    },
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
      catalogue: () =>
        CatalogueState.Ready({ attempt: 0, allValues, printingSets: {} }),
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

describe('collection page', () => {
  test('entering loads the collection, then searches only owned cards', () => {
    const collectionRoute = AppRoute.Collection(CatalogueQuery.empty)
    const onCollection = modifyFields(init(collectionRoute, ada), {
      catalogue: () =>
        CatalogueState.Ready({ attempt: 0, allValues, printingSets: {} }),
    })
    const entered = enterRoute(onCollection, collectionRoute)
    const printingId = Printing.PrintingId.make('tst-001-010')

    expect(entered.commands?.map(({ name }) => name)).toStrictEqual([
      CollectionState.LoadCollection.name,
    ])

    story(
      update,
      given(entered.model),
      message(
        Message.GotCollectionMessage({
          message: CollectionState.Message.SucceededLoadCollection({
            items: [{ printingId, quantity: Collection.OwnedQuantity.make(1) }],
          }),
        }),
      ),
      Command.expectHas(
        CataloguePage.SearchCatalogue({
          query: { ...CatalogueQuery.empty, ownership: 'Owned' },
          limit: CataloguePage.PAGE_SIZE,
          ownedPrintingIds: [printingId],
        }),
      ),
      Command.resolve(
        CataloguePage.SearchCatalogue,
        CataloguePage.Message.SkippedSearchCatalogue(),
      ),
    )
  })

  test('Refresh reloads the collection', () => {
    story(
      update,
      given(
        modifyFields(init(AppRoute.Collection(CatalogueQuery.empty), ada), {
          collection: () =>
            CollectionState.Model.Ready({
              owned: {},
              saves: {},
              nextRevision: 0,
              refresh: CollectionState.Refresh.Idle(),
            }),
        }),
      ),
      message(Message.ClickedRefreshCollection()),
      Command.expectExact(CollectionState.LoadCollection),
      Command.resolve(
        CollectionState.LoadCollection,
        CollectionState.Message.FailedLoadCollection(),
      ),
      model(next => {
        expect(
          next.collection._tag === 'Ready' && next.collection.refresh,
        ).toStrictEqual(CollectionState.Refresh.Failed())
      }),
    )
  })
})

describe('decks', () => {
  const deckId = Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11')
  const deck: Deck.Deck = {
    id: deckId,
    name: Deck.DeckName.make('Vi aggro'),
    contents: Deck.empty,
  }
  const readyDecks = DecksState.Model.Ready({
    decks: [],
    saves: {},
    nextRevision: 0,
    creation: DecksState.Creation.Idle(),
    removals: {},
  })

  test('the decks page loads decks once', () => {
    const entered = enterRoute(init(AppRoute.Decks(), ada), AppRoute.Decks())

    expect(entered.commands?.map(({ name }) => name)).toStrictEqual([
      DecksState.LoadDecks.name,
    ])
  })

  test('creating a deck opens it', () => {
    story(
      update,
      given(
        modifyFields(init(AppRoute.Decks(), ada), {
          decks: () => readyDecks,
        }),
      ),
      message(
        Message.GotDeckListPageMessage({
          message: DeckListPage.Message.UpdatedNewName({ value: 'Vi aggro' }),
        }),
      ),
      message(
        Message.GotDeckListPageMessage({
          message: DeckListPage.Message.SubmittedNewDeck(),
        }),
      ),
      Command.resolve(
        DecksState.CreateDeck,
        DecksState.Message.SucceededCreateDeck({ deck }),
      ),
      Command.expectExact(OpenDeck),
      Command.resolve(OpenDeck, Message.CompletedOpenDeck()),
    )
  })

  test('an edit on the deck page is saved', () => {
    story(
      update,
      given(
        modifyFields(init(AppRoute.Deck({ deckId }), ada), {
          decks: () => modifyFields(readyDecks, { decks: () => [deck] }),
        }),
      ),
      message(
        Message.GotDeckPageMessage({
          message: DeckPage.Message.UpdatedName({ value: 'Vi tempo' }),
        }),
      ),
      Command.resolve(
        DecksState.WaitToSaveDeck,
        DecksState.Message.ElapsedSaveDeckDelay({ deckId, revision: 0 }),
      ),
      Command.expectExact(DecksState.SaveDeck),
      Command.resolve(
        DecksState.SaveDeck,
        DecksState.Message.SucceededSaveDeck({ deckId, revision: 0 }),
      ),
      model(next => {
        expect(
          Option.map(
            DecksState.maybeDeck(next.decks, deckId),
            ({ name }) => name,
          ),
        ).toStrictEqual(Option.some('Vi tempo'))
      }),
    )
  })
})

describe('wishlist', () => {
  test('opening the wishlist loads decks, collection and wishlist once', () => {
    const entered = enterRoute(
      init(AppRoute.Wishlist(), ada),
      AppRoute.Wishlist(),
    )

    expect(entered.commands?.map(({ name }) => name)).toStrictEqual([
      DecksState.LoadDecks.name,
      CollectionState.LoadCollection.name,
      WishlistState.LoadWishlist.name,
    ])
  })
})
