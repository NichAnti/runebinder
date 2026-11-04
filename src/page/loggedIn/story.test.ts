import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import {
  CatalogueQuery,
  Collection,
  Deck,
  Printing,
  type User,
} from '../../domain'
import { AppRoute, type LoggedInRoute } from '../../route'
import { ada, allValues, testCard } from '../../testing'
import * as CardTraderState from './cardTrader'
import * as CardTraderWishlists from './cardTraderWishlists'
import * as CollectionState from './collection'
import * as DecksState from './decks'
import { Message } from './message'
import { CatalogueState, type Model, init as initModel } from './model'
import * as CardPage from './page/card'
import * as CataloguePage from './page/catalogue'
import * as DeckPage from './page/deck'
import * as DeckListPage from './page/deckList'
import * as WishlistPage from './page/wishlist'
import { OpenDeck, enterRoute, update } from './update'
import * as WishlistState from './wishlist'

const init = (route: LoggedInRoute, user: User.User): Model =>
  modifyFields(initModel(route, user), {
    cardTrader: cardTrader =>
      modifyFields(cardTrader, {
        connection: () =>
          CardTraderState.Connection.Disconnected({ wasRejected: false }),
      }),
  })

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
        DecksState.LoadDecks,
        WishlistState.LoadWishlist,
      ),
      Command.resolve(
        CataloguePage.SearchCatalogue,
        CataloguePage.Message.SkippedSearchCatalogue(),
      ),
      Command.resolve(
        CollectionState.LoadCollection,
        CollectionState.Message.SucceededLoadCollection({ items: [] }),
      ),
      Command.resolve(
        DecksState.LoadDecks,
        DecksState.Message.FailedLoadDecks(),
      ),
      Command.resolve(
        WishlistState.LoadWishlist,
        WishlistState.Message.FailedLoadWishlist(),
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
      DecksState.LoadDecks.name,
      WishlistState.LoadWishlist.name,
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

describe('my collection on the cards page', () => {
  test('entering loads the collection, then searches only owned cards', () => {
    const ownedRoute = AppRoute.Catalogue({
      ...CatalogueQuery.empty,
      ownership: 'Owned',
    })
    const onOwned = modifyFields(init(ownedRoute, ada), {
      catalogue: () =>
        CatalogueState.Ready({ attempt: 0, allValues, printingSets: {} }),
    })
    const entered = enterRoute(onOwned, ownedRoute)
    const printingId = Printing.PrintingId.make('tst-001-010')

    expect(entered.commands?.map(({ name }) => name)).toStrictEqual([
      CollectionState.LoadCollection.name,
      DecksState.LoadDecks.name,
      WishlistState.LoadWishlist.name,
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
          viewPrintingIds: [printingId],
        }),
      ),
      Command.resolve(
        CataloguePage.SearchCatalogue,
        CataloguePage.Message.SkippedSearchCatalogue(),
      ),
    )
  })
})

describe('wanted cards on the cards page', () => {
  test('the Wanted view searches once decks, collection and wishlist are loaded', () => {
    const wantedRoute = AppRoute.Catalogue({
      ...CatalogueQuery.empty,
      ownership: 'Wanted',
    })
    const vi = Printing.PrintingId.make('tst-001-010')
    const onWanted = modifyFields(init(wantedRoute, ada), {
      catalogue: () =>
        CatalogueState.Ready({ attempt: 0, allValues, printingSets: {} }),
      collection: () =>
        CollectionState.Model.Ready({ owned: {}, saves: {}, nextRevision: 0 }),
      decks: () =>
        DecksState.Model.Ready({
          decks: [],
          saves: {},
          nextRevision: 0,
          creation: DecksState.Creation.Idle(),
          removals: {},
        }),
      wishlist: () => WishlistState.Model.Loading(),
    })

    expect(enterRoute(onWanted, wantedRoute).commands ?? []).toStrictEqual([])

    story(
      update,
      given(onWanted),
      message(
        Message.GotWishlistMessage({
          message: WishlistState.Message.SucceededLoadWishlist({
            wishlist: {
              items: [
                { printingId: vi, quantity: Collection.OwnedQuantity.make(2) },
              ],
              cardTraderLinks: [],
            },
          }),
        }),
      ),
      Command.expectHas(
        CataloguePage.SearchCatalogue({
          query: { ...CatalogueQuery.empty, ownership: 'Wanted' },
          limit: CataloguePage.PAGE_SIZE,
          viewPrintingIds: [vi],
        }),
      ),
      Command.resolve(
        CataloguePage.SearchCatalogue,
        CataloguePage.Message.SkippedSearchCatalogue(),
      ),
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

  test('duplicating a deck creates the copy', () => {
    const onDeck = modifyFields(init(AppRoute.Deck({ deckId }), ada), {
      decks: () =>
        DecksState.Model.Ready({
          decks: [deck],
          saves: {},
          nextRevision: 0,
          creation: DecksState.Creation.Idle(),
          removals: {},
        }),
      deckPage: page =>
        modifyFields(page, { maybeDeckId: () => Option.some(deckId) }),
    })
    const duplicated = update(
      onDeck,
      Message.GotDeckPageMessage({
        message: DeckPage.Message.ClickedDuplicate(),
      }),
    )

    expect(duplicated.commands?.map(({ name }) => name)).toStrictEqual([
      DecksState.CreateDeck.name,
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
      init(AppRoute.Wishlists(), ada),
      AppRoute.Wishlists(),
    )

    expect(entered.commands?.map(({ name }) => name)).toStrictEqual([
      DecksState.LoadDecks.name,
      CollectionState.LoadCollection.name,
      WishlistState.LoadWishlist.name,
    ])
  })
})

describe('CardTrader connection', () => {
  test('the first page reads the stored token once, without calling CardTrader', () => {
    const route = AppRoute.Decks()
    const entered = enterRoute(initModel(route, ada), route)
    const again = enterRoute(entered.model, route)

    expect(entered.commands?.map(({ name }) => name)).toStrictEqual([
      CardTraderState.ReadStoredToken.name,
      DecksState.LoadDecks.name,
    ])
    expect(again.commands ?? []).toStrictEqual([])
  })

  test('connecting on the wishlists page lists the CardTrader wishlists', () => {
    const connected = update(
      init(AppRoute.Wishlists(), ada),
      Message.GotCardTraderMessage({
        message: CardTraderState.Message.SucceededConnectCardTrader({
          appName: 'Deck app',
          isRemembered: false,
        }),
      }),
    )

    expect(connected.commands?.map(({ name }) => name)).toContain(
      CardTraderWishlists.ListWishlists.name,
    )
  })

  test('a token CardTrader rejects disconnects and forgets the listing', () => {
    const connected = modifyFields(init(AppRoute.Wishlists(), ada), {
      cardTrader: cardTrader =>
        modifyFields(cardTrader, {
          connection: () =>
            CardTraderState.Connection.Connected({
              isRemembered: false,
              maybeAppName: Option.none(),
            }),
        }),
      cardTraderWishlists: remote =>
        modifyFields(remote, {
          listing: () => CardTraderWishlists.Listing.Loading(),
        }),
    })
    const rejected = update(
      connected,
      Message.GotCardTraderWishlistsMessage({
        message: CardTraderWishlists.Message.FailedListWishlists({
          reason: 'InvalidToken',
        }),
      }),
    )

    expect(rejected.model.cardTrader.connection).toStrictEqual(
      CardTraderState.Connection.Disconnected({ wasRejected: true }),
    )
    expect(rejected.model.cardTraderWishlists.listing).toStrictEqual(
      CardTraderWishlists.Listing.NotLoaded(),
    )
    expect(rejected.commands?.map(({ name }) => name)).toStrictEqual([
      CardTraderState.ForgetCardTraderToken.name,
    ])
  })
})

describe('marking wishlist cards as bought', () => {
  test('adds the version that arrived and lowers the custom wishlist', () => {
    const wanted = Printing.PrintingId.make('tst-001a-010')
    const arrived = Printing.PrintingId.make('tst-001-010')
    const onWishlist = modifyFields(init(AppRoute.Wishlists(), ada), {
      catalogue: () =>
        CatalogueState.Ready({ attempt: 0, allValues, printingSets: {} }),
      decks: () =>
        DecksState.Model.Ready({
          decks: [],
          saves: {},
          nextRevision: 0,
          creation: DecksState.Creation.Idle(),
          removals: {},
        }),
      collection: () =>
        CollectionState.Model.Ready({
          owned: { [arrived]: Collection.OwnedQuantity.make(1) },
          saves: {},
          nextRevision: 0,
        }),
      wishlist: () =>
        WishlistState.Model.Ready({
          added: { [wanted]: Collection.OwnedQuantity.make(3) },
          links: {},
          saves: {},
          nextRevision: 0,
          operations: {},
        }),
    })
    const marked = update(
      onWishlist,
      Message.GotWishlistPageMessage({
        message: WishlistPage.Message.ClickedBought({
          purchases: [{ wanted, bought: arrived, copies: 2, isCustom: true }],
        }),
      }),
    )

    expect(
      marked.model.collection._tag === 'Ready' &&
        marked.model.collection.owned[arrived],
    ).toBe(3)
    expect(
      marked.model.wishlist._tag === 'Ready' &&
        marked.model.wishlist.added[wanted],
    ).toBe(1)
  })
})
