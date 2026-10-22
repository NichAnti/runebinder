import { Effect, Option } from 'effect'
import { Command, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Printing } from '../../../../domain'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
} from '../../../../service'
import { Message } from './message'
import { CardState, type Model } from './model'

type UpdateReturn = Update.Return<Model, Message, CatalogueIndexService>

// COMMAND

export const LoadCard = Command.define('LoadCard', {
  args: { cardId: Printing.CardId },
  messages: [Message.SucceededLoadCard, Message.SkippedLoadCard],
  execute: ({ cardId }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      return Message.SucceededLoadCard({
        cardId,
        maybeCard: CatalogueIndex.cardById(index, cardId),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCard()),
      ),
    ),
})

// ROUTE

const isShowing = (model: Model, cardId: Printing.CardId): boolean =>
  CardState.match(model.state, {
    Waiting: () => false,
    Found: ({ card }) => card.id === cardId,
    Missing: missing => missing.cardId === cardId,
  })

export const enter = (
  model: Model,
  cardId: Printing.CardId,
  isIndexReady: boolean,
): UpdateReturn => {
  if (isShowing(model, cardId)) {
    return { model }
  } else if (isIndexReady) {
    return {
      model: modifyFields(model, { state: () => CardState.Waiting() }),
      commands: [LoadCard({ cardId })],
    }
  } else {
    return { model: modifyFields(model, { state: () => CardState.Waiting() }) }
  }
}

// UPDATE

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    SucceededLoadCard: ({ cardId, maybeCard }) => ({
      model: modifyFields(model, {
        state: () =>
          Option.match(maybeCard, {
            onNone: () => CardState.Missing({ cardId }),
            onSome: card => CardState.Found({ card }),
          }),
      }),
    }),
    SkippedLoadCard: () => ({ model }),
  })
