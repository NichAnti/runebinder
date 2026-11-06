import { Array, Duration, Effect, Option, Record, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Deck, DeckEdit } from '../../../domain'
import { ApiClient } from '../../../service'
import { Message, OutMessage } from './message'
import { Creation, Model, type Ready, Save } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage,
  ApiClient
>

const SAVE_DELAY = Duration.millis(600)

// COMMAND

export const LoadDecks = Command.define('LoadDecks', {
  messages: [Message.SucceededLoadDecks, Message.FailedLoadDecks],
  execute: Effect.gen(function* () {
    const api = yield* ApiClient
    const decks = yield* api.decks.list()
    return Message.SucceededLoadDecks({ decks })
  }).pipe(Effect.catch(() => Effect.succeed(Message.FailedLoadDecks()))),
})

export const CreateDeck = Command.define('CreateDeck', {
  args: { name: Deck.DeckName, contents: Deck.DeckContents },
  messages: [Message.SucceededCreateDeck, Message.FailedCreateDeck],
  execute: payload =>
    Effect.gen(function* () {
      const api = yield* ApiClient
      const deck = yield* api.decks.create({ payload })
      return Message.SucceededCreateDeck({ deck })
    }).pipe(Effect.catch(() => Effect.succeed(Message.FailedCreateDeck()))),
})

export const WaitToSaveDeck = Command.define('WaitToSaveDeck', {
  args: { deckId: Deck.DeckId, revision: Schema.Int },
  messages: [Message.ElapsedSaveDeckDelay],
  execute: ({ deckId, revision }) =>
    Effect.sleep(SAVE_DELAY).pipe(
      Effect.as(Message.ElapsedSaveDeckDelay({ deckId, revision })),
    ),
})

export const SaveDeck = Command.define('SaveDeck', {
  args: {
    deckId: Deck.DeckId,
    name: Deck.DeckName,
    contents: Deck.DeckContents,
    revision: Schema.Int,
  },
  messages: [Message.SucceededSaveDeck, Message.FailedSaveDeck],
  execute: ({ deckId, name, contents, revision }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient
      yield* api.decks.replace({
        params: { deckId },
        payload: { name, contents },
      })
      return Message.SucceededSaveDeck({ deckId, revision })
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(Message.FailedSaveDeck({ deckId, revision })),
      ),
    ),
})

export const RemoveDeck = Command.define('RemoveDeck', {
  args: { deckId: Deck.DeckId },
  messages: [Message.SucceededRemoveDeck, Message.FailedRemoveDeck],
  execute: ({ deckId }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient
      yield* api.decks.remove({ params: { deckId } })
      return Message.SucceededRemoveDeck({ deckId })
    }).pipe(
      Effect.catch(() => Effect.succeed(Message.FailedRemoveDeck({ deckId }))),
    ),
})

// ENTRY

const whenReady = (
  model: Model,
  f: (ready: Ready) => UpdateReturn,
): UpdateReturn => (model._tag === 'Ready' ? f(model) : { model })

const loading = (): UpdateReturn => ({
  model: Model.Loading(),
  commands: [LoadDecks()],
})

export const ensureLoaded = (model: Model): UpdateReturn =>
  model._tag === 'NotLoaded' ? loading() : { model }

export type NewDeck = Readonly<{
  name: Deck.DeckName
  contents: Deck.DeckContents
}>

export const create = (model: Model, { name, contents }: NewDeck) =>
  whenReady(model, ready =>
    ready.creation._tag === 'Creating'
      ? { model }
      : {
          model: modifyFields(ready, { creation: () => Creation.Creating() }),
          commands: [CreateDeck({ name, contents })],
        },
  )

const applyTo = (deck: Deck.Deck, edit: DeckEdit.DeckEdit): Deck.Deck =>
  edit._tag === 'Rename'
    ? { ...deck, name: edit.name }
    : { ...deck, contents: DeckEdit.applyEdit(deck.contents, edit) }

export type Edits = Readonly<{
  deckId: Deck.DeckId
  edits: Array.NonEmptyReadonlyArray<DeckEdit.DeckEdit>
}>

export const edit = (model: Model, { deckId, edits }: Edits) =>
  whenReady(model, ready =>
    Array.some(ready.decks, deck => deck.id === deckId)
      ? {
          model: modifyFields(ready, {
            decks: Array.map(deck =>
              deck.id === deckId ? Array.reduce(edits, deck, applyTo) : deck,
            ),
            saves: saves =>
              Record.set(
                saves,
                deckId,
                Save.Waiting({ revision: ready.nextRevision }),
              ),
            nextRevision: revision => revision + 1,
          }),
          commands: [WaitToSaveDeck({ deckId, revision: ready.nextRevision })],
        }
      : { model },
  )

export const retry = (model: Model): UpdateReturn =>
  model._tag === 'Failed' ? loading() : { model }

export const remove = (model: Model, deckId: Deck.DeckId) =>
  whenReady(model, ready =>
    Option.exists(
      Record.get(ready.removals, deckId),
      removal => removal === 'Removing',
    )
      ? { model }
      : {
          model: modifyFields(ready, {
            removals: removals => Record.set(removals, deckId, 'Removing'),
          }),
          commands: [RemoveDeck({ deckId })],
        },
  )

// UPDATE

const isCurrent = (
  ready: Ready,
  deckId: Deck.DeckId,
  revision: number,
): boolean =>
  Option.exists(
    Record.get(ready.saves, deckId),
    save => save.revision === revision,
  )

const isWaiting = (
  ready: Ready,
  deckId: Deck.DeckId,
  revision: number,
): boolean =>
  Option.exists(
    Record.get(ready.saves, deckId),
    save => save._tag === 'Waiting' && save.revision === revision,
  )

const saveNow = (ready: Ready, deckId: Deck.DeckId, revision: number) =>
  Option.map(
    Array.findFirst(ready.decks, deck => deck.id === deckId),
    deck =>
      SaveDeck({ deckId, name: deck.name, contents: deck.contents, revision }),
  )

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededLoadDecks: ({ decks }) => ({
      model: Model.Ready({
        decks,
        saves: {},
        nextRevision: 0,
        creation: Creation.Idle(),
        removals: {},
      }),
    }),

    FailedLoadDecks: () => ({ model: Model.Failed() }),

    ClickedRetryLoadDecks: () => retry(model),

    SucceededCreateDeck: ({ deck }) =>
      whenReady(model, ready => ({
        model: modifyFields(ready, {
          decks: decks => Array.prepend(decks, deck),
          creation: () => Creation.Idle(),
        }),
        outMessage: OutMessage.CreatedDeck({ deckId: deck.id }),
      })),

    FailedCreateDeck: () =>
      whenReady(model, ready => ({
        model: modifyFields(ready, { creation: () => Creation.Failed() }),
      })),

    ElapsedSaveDeckDelay: ({ deckId, revision }) =>
      whenReady(model, ready =>
        isWaiting(ready, deckId, revision)
          ? {
              model: modifyFields(ready, {
                saves: saves =>
                  Record.set(saves, deckId, Save.Saving({ revision })),
              }),
              commands: Option.toArray(saveNow(ready, deckId, revision)),
            }
          : { model },
      ),

    SucceededSaveDeck: ({ deckId, revision }) =>
      whenReady(model, ready =>
        isCurrent(ready, deckId, revision)
          ? {
              model: modifyFields(ready, {
                saves: saves => Record.remove(saves, deckId),
              }),
            }
          : { model },
      ),

    FailedSaveDeck: ({ deckId, revision }) =>
      whenReady(model, ready =>
        isCurrent(ready, deckId, revision)
          ? {
              model: modifyFields(ready, {
                saves: saves =>
                  Record.set(saves, deckId, Save.Failed({ revision })),
              }),
            }
          : { model },
      ),

    ClickedRetryDeckSaves: () =>
      whenReady(model, ready => {
        const retries = Array.map(
          Record.keys(
            Record.filter(ready.saves, save => save._tag === 'Failed'),
          ),
          (deckId, index) => ({ deckId, revision: ready.nextRevision + index }),
        )

        return {
          model: modifyFields(ready, {
            saves: saves =>
              Array.reduce(retries, saves, (next, { deckId, revision }) =>
                Record.set(next, deckId, Save.Saving({ revision })),
              ),
            nextRevision: revision => revision + Array.length(retries),
          }),
          commands: Array.flatMap(retries, ({ deckId, revision }) =>
            Option.toArray(saveNow(ready, deckId, revision)),
          ),
        }
      }),

    SucceededRemoveDeck: ({ deckId }) =>
      whenReady(model, ready => ({
        model: modifyFields(ready, {
          decks: Array.filter(deck => deck.id !== deckId),
          saves: saves => Record.remove(saves, deckId),
          removals: removals => Record.remove(removals, deckId),
        }),
        outMessage: OutMessage.RemovedDeck({ deckId }),
      })),

    FailedRemoveDeck: ({ deckId }) =>
      whenReady(model, ready => ({
        model: modifyFields(ready, {
          removals: removals => Record.set(removals, deckId, 'Failed'),
        }),
      })),
  })

// QUERY

export const maybeDeck = (
  model: Model,
  deckId: Deck.DeckId,
): Option.Option<Deck.Deck> =>
  model._tag === 'Ready'
    ? Array.findFirst(model.decks, deck => deck.id === deckId)
    : Option.none()

export const failedSaveCount = (model: Model): number =>
  model._tag === 'Ready'
    ? Record.size(Record.filter(model.saves, save => save._tag === 'Failed'))
    : 0
