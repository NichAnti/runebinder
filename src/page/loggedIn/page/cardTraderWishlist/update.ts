import { Array, Effect, Number, Option, Record, Result } from 'effect'
import { Command, Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { CardTraderImport, type Printing } from '../../../../domain'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
} from '../../../../service'
import { Toast } from '../../../../ui'
import { Message, OutMessage } from './message'
import type { Model } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage,
  CatalogueIndexService
>
type EnterReturn = Update.Return<Model, Message, CatalogueIndexService>

// COMMAND

export const MatchLines = Command.define('MatchLines', {
  args: { wishlist: CardTraderImport.RemoteWishlist },
  messages: [Message.SucceededMatchLines, Message.SkippedMatchLines],
  execute: ({ wishlist }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const lines = CardTraderImport.importLinesOf(wishlist.items, key =>
        CatalogueIndex.printingsForCardTrader(index, key),
      )
      const cards = Array.getSomes(
        Array.map(
          Array.dedupe(
            Array.filterMap(lines, ({ match }) =>
              match._tag === 'Matched'
                ? Result.succeed(match.cardId)
                : Result.failVoid,
            ),
          ),
          cardId => CatalogueIndex.cardById(index, cardId),
        ),
      )

      return Message.SucceededMatchLines({
        wishlistId: wishlist.id,
        lines,
        cards,
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedMatchLines()),
      ),
    ),
})

// TOAST

const toastFold = {
  read: (model: Model) => Option.some(model.toast),
  write: (model: Model, nextToast: Toast.Model): Model =>
    modifyFields(model, { toast: () => nextToast }),
  toParentMessage: (message: Toast.Message) =>
    Message.GotToastMessage({ message }),
  foldOutMessage: Toast.Notification.OutMessage.match<
    Update.Step<Model, Message>
  >({
    DismissedToast: () => stepModel => ({ model: stepModel }),
  }),
}

const foldToast = Update.foldChild({
  update: Toast.Notification.update,
  ...toastFold,
})
const showToast = Update.foldChild({
  update: Toast.Notification.show,
  ...toastFold,
})

// ROUTE

export const enter = (
  model: Model,
  maybeWishlist: Option.Option<CardTraderImport.RemoteWishlist>,
  isIndexReady: boolean,
): EnterReturn =>
  Option.match(maybeWishlist, {
    onNone: () => ({ model }),
    onSome: wishlist =>
      isIndexReady &&
      !Option.exists(
        model.maybeMatched,
        ({ wishlistId }) => wishlistId === wishlist.id,
      )
        ? {
            model: modifyFields(model, { selected: () => ({}) }),
            commands: [MatchLines({ wishlist })],
          }
        : { model },
  })

// UPDATE

const importedText = (copies: number): string =>
  copies === 1
    ? 'Added 1 card to the custom wishlist.'
    : `Added ${copies} cards to the custom wishlist.`

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededMatchLines: ({ wishlistId, lines, cards }) => ({
      model: modifyFields(model, {
        maybeMatched: () =>
          Option.some({
            wishlistId,
            lines,
            cards: Record.fromEntries(
              Array.map(
                cards,
                (card): readonly [Printing.CardId, Printing.Card] => [
                  card.id,
                  card,
                ],
              ),
            ),
          }),
      }),
    }),

    SkippedMatchLines: () => ({ model }),

    ToggledLine: ({ key, isChecked }) => ({
      model: modifyFields(model, {
        selected: selected => Record.set(selected, key, isChecked),
      }),
    }),

    ClickedImport: ({ keys }) =>
      Option.match(model.maybeMatched, {
        onNone: () => ({ model }),
        onSome: ({ lines }) =>
          Array.match(
            CardTraderImport.importedOf(
              Array.filter(lines, ({ key }) => Array.contains(keys, key)),
            ),
            {
              onEmpty: () => ({ model }),
              onNonEmpty: items => {
                const shown = showToast(
                  modifyFields(model, { selected: () => ({}) }),
                  {
                    variant: 'Success',
                    payload: {
                      text: importedText(
                        Number.sumAll(
                          Array.map(items, ({ quantity }) => quantity),
                        ),
                      ),
                    },
                  },
                )

                return {
                  model: shown.model,
                  commands: shown.commands ?? [],
                  outMessage: OutMessage.Imported({ items }),
                }
              },
            },
          ),
      }),

    ClickedConnect: () => ({
      model,
      outMessage: OutMessage.RequestedConnect(),
    }),

    ClickedRetry: () => ({ model, outMessage: OutMessage.RequestedRetry() }),

    GotToastMessage: ({ message }) => foldToast(model, message),
  })
