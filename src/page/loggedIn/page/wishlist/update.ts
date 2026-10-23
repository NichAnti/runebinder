import { Array, Effect, HashSet, Option, Record, Schema, String } from 'effect'
import { Command, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import {
  CatalogueQuery,
  type Collection,
  type Missing,
  Printing,
  Wishlist,
} from '../../../../domain'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
} from '../../../../service'
import { cardsByPrinting } from '../deck/lines'
import { Message, OutMessage } from './message'
import type { Model } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage,
  CatalogueIndexService
>
type EnterReturn = Update.Return<Model, Message, CatalogueIndexService>

const SEARCH_LIMIT = 8
const WISHLIST_NAME = 'Riftbound decks (from cardtrader app)'

export type Context = Readonly<{
  needs: ReadonlyArray<Missing.Need>
  added: Collection.Owned
}>

// COMMAND

export const LoadWishlistCards = Command.define('LoadWishlistCards', {
  args: { printingIds: Schema.Array(Printing.PrintingId) },
  messages: [Message.SucceededLoadWishlistCards, Message.SkippedLoadCatalogue],
  execute: ({ printingIds }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      return Message.SucceededLoadWishlistCards({
        cards: Array.getSomes(
          Array.map(CatalogueIndex.cardIdsOwning(index, printingIds), cardId =>
            CatalogueIndex.cardById(index, cardId),
          ),
        ),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

export const SearchCardsToWish = Command.define('SearchCardsToWish', {
  args: { term: Schema.String },
  messages: [Message.SucceededSearchCardsToWish, Message.SkippedLoadCatalogue],
  execute: ({ term }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const result = yield* CatalogueIndex.searchCards(
        index,
        CatalogueQuery.withTerm(CatalogueQuery.empty, term),
        SEARCH_LIMIT,
        [],
      )
      return Message.SucceededSearchCardsToWish({ term, cards: result.cards })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

export const LoadCardToWish = Command.define('LoadCardToWish', {
  args: { cardId: Printing.CardId },
  messages: [Message.SucceededLoadCardToWish, Message.SkippedLoadCatalogue],
  execute: ({ cardId }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      return Option.match(CatalogueIndex.cardById(index, cardId), {
        onNone: () => Message.SkippedLoadCatalogue(),
        onSome: card => Message.SucceededLoadCardToWish({ card }),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

// LINES

export const finderOf = (model: Model) => {
  const byPrinting = cardsByPrinting(model.cards)

  return (printingId: Printing.PrintingId): Option.Option<Printing.Printing> =>
    Option.flatMap(Option.fromNullishOr(byPrinting.get(printingId)), card =>
      Array.findFirst(card.printings, ({ id }) => id === printingId),
    )
}

export const linesFor = (context: Context) =>
  Wishlist.linesOf(context.needs, context.added)

// ROUTE

export const enter = (
  model: Model,
  context: Context,
  isIndexReady: boolean,
): EnterReturn => {
  const known = HashSet.fromIterable(
    Array.flatMap(Record.values(model.cards), card =>
      Array.map(card.printings, ({ id }) => id),
    ),
  )
  const missing = Array.filter(
    Array.map(linesFor(context), ({ printingId }) => printingId),
    printingId => !HashSet.has(known, printingId),
  )

  return isIndexReady && Array.isReadonlyArrayNonEmpty(missing)
    ? { model, commands: [LoadWishlistCards({ printingIds: missing })] }
    : { model }
}

// UPDATE

export const update = (context: Context) => (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededLoadWishlistCards: ({ cards }) => ({
      model: modifyFields(model, {
        cards: existing =>
          Array.reduce(cards, existing, (known, card) =>
            Record.set(known, card.id, card),
          ),
      }),
    }),

    SkippedLoadCatalogue: () => ({ model }),

    UpdatedSearch: ({ value }) => {
      const term = String.trim(value)
      const nextModel: Model = modifyFields(model, {
        searchText: () => value,
        searchResults: results => (String.isEmpty(term) ? [] : results),
      })

      return String.isEmpty(term)
        ? { model: nextModel }
        : { model: nextModel, commands: [SearchCardsToWish({ term })] }
    },

    SucceededSearchCardsToWish: ({ term, cards }) =>
      term === String.trim(model.searchText)
        ? { model: modifyFields(model, { searchResults: () => cards }) }
        : { model },

    ClickedAddCard: ({ cardId }) => ({
      model,
      commands: [LoadCardToWish({ cardId })],
    }),

    SucceededLoadCardToWish: ({ card }) => ({
      model: modifyFields(model, {
        cards: cards => Record.set(cards, card.id, card),
      }),
      outMessage: OutMessage.SteppedAdded({
        printingId: Printing.basePrinting(card).id,
        step: 1,
      }),
    }),

    ClickedStepAdded: ({ printingId, step }) => ({
      model,
      outMessage: OutMessage.SteppedAdded({ printingId, step }),
    }),

    ClickedSend: () =>
      Array.match(
        Wishlist.cardTraderLinesOf(linesFor(context), finderOf(model)).lines,
        {
          onEmpty: () => ({ model }),
          onNonEmpty: lines => ({
            model,
            outMessage: OutMessage.RequestedSend({
              name: WISHLIST_NAME,
              lines,
            }),
          }),
        },
      ),

    ClickedRetry: () => ({ model, outMessage: OutMessage.RequestedRetry() }),
  })
