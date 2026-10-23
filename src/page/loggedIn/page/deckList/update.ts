import { Array, Effect, Option, Result, Schema, String } from 'effect'
import { Command, type Update } from 'foldkit'
import { Rule, makeRules, validate } from 'foldkit/fieldValidation'
import { modifyFields } from 'foldkit/struct'

import { Deck, DeckCode } from '../../../../domain'
import {
  CatalogueIndexResource,
  type CatalogueIndexService,
} from '../../../../service'
import { Message, OutMessage } from './message'
import { Import, type Model, init } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage,
  CatalogueIndexService
>

// VALIDATION

const nameRules = makeRules({
  required: 'Give the deck a name',
  rules: [
    Rule.maxLength(
      Deck.MAX_NAME_LENGTH,
      `Use at most ${Deck.MAX_NAME_LENGTH} characters`,
    ),
  ],
})
const codeRules = makeRules({ required: 'Paste a deck code' })

const validateName = validate(nameRules)
const validateCode = validate(codeRules)

// COMMAND

export const ReadDeckCode = Command.define('ReadDeckCode', {
  args: { name: Deck.DeckName, code: Schema.String },
  messages: [
    Message.SucceededReadDeckCode,
    Message.FailedReadDeckCode,
    Message.SkippedReadDeckCode,
  ],
  execute: ({ name, code }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const lookup = DeckCode.lookupFrom(
        Array.flatMap(Array.fromIterable(index.cards.values()), card =>
          Array.fromIterable(card.printings),
        ),
      )

      return Result.match(DeckCode.decode(code, lookup), {
        onSuccess: contents =>
          Message.SucceededReadDeckCode({ name, contents }),
        onFailure: problem => Message.FailedReadDeckCode({ problem }),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedReadDeckCode()),
      ),
    ),
})

// UPDATE

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    UpdatedNewName: ({ value }) => ({
      model: modifyFields(model, { newName: () => validateName(value) }),
    }),

    SubmittedNewDeck: () =>
      Option.match(Deck.parseName(model.newName.value), {
        onNone: () => ({
          model: modifyFields(model, {
            newName: () => validateName(model.newName.value),
          }),
        }),
        onSome: name => ({
          model: modifyFields(model, { newName: () => init().newName }),
          outMessage: OutMessage.RequestedCreateDeck({
            name,
            contents: Deck.empty,
          }),
        }),
      }),

    UpdatedImportName: ({ value }) => ({
      model: modifyFields(model, { importName: () => validateName(value) }),
    }),

    UpdatedImportCode: ({ value }) => ({
      model: modifyFields(model, {
        importCode: () => validateCode(value),
        import: () => Import.Idle(),
      }),
    }),

    SubmittedImport: () => {
      const maybeName = Deck.parseName(model.importName.value)
      const code = model.importCode.value

      if (Option.isNone(maybeName) || String.isEmpty(String.trim(code))) {
        return {
          model: modifyFields(model, {
            importName: () => validateName(model.importName.value),
            importCode: () => validateCode(code),
          }),
        }
      } else {
        return {
          model: modifyFields(model, { import: () => Import.Reading() }),
          commands: [ReadDeckCode({ name: maybeName.value, code })],
        }
      }
    },

    SucceededReadDeckCode: ({ name, contents }) => ({
      model: init(),
      outMessage: OutMessage.RequestedCreateDeck({ name, contents }),
    }),

    FailedReadDeckCode: ({ problem }) => ({
      model: modifyFields(model, { import: () => Import.Failed({ problem }) }),
    }),

    SkippedReadDeckCode: () => ({
      model: modifyFields(model, { import: () => Import.Idle() }),
    }),

    ClickedRetryLoadDecks: () => ({
      model,
      outMessage: OutMessage.RequestedRetryLoadDecks(),
    }),
  })
