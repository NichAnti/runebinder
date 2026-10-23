import { Array, Match } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Deck, type DeckCode } from '../../../../domain'
import { deckRouter } from '../../../../route'
import { Button, Link, Notice, TextField } from '../../../../ui'
import * as DecksState from '../../decks'
import { Message } from './message'
import type { Model } from './model'

export type ViewInputs = Readonly<{ decks: DecksState.Model }>

export const problemText = (problem: DeckCode.DeckCodeProblem): string =>
  Match.value(problem).pipe(
    Match.withReturnType<string>(),
    Match.tagsExhaustive({
      Unreadable: () => 'This is not a deck code.',
      UnknownCard: ({ cardCode }) => `${cardCode} is not in the catalogue.`,
      TooManyCopies: ({ cardCode }) => `${cardCode} has too many copies.`,
      SeveralLegends: () =>
        'The code has more than one starting legend, so it cannot tell which one leads the deck.',
      ChampionNotInMainDeck: ({ cardCode }) =>
        `The chosen champion ${cardCode} is not in the main deck.`,
      NotEncodable: ({ printingId }) =>
        `${printingId} cannot be written in a deck code.`,
      RejectedByFormat: () => 'The deck code format rejected this deck.',
    }),
  )

const cardCount = (deck: Deck.Deck): string => {
  const size = Deck.mainDeckSize(deck.contents)
  return size === 1 ? '1 card' : `${size} cards`
}

const listView = (
  decks: ReadonlyArray<Deck.Deck>,
  h: HtmlBuilder<Message>,
): Html =>
  Array.match(decks, {
    onEmpty: () =>
      Notice.view(
        {
          title: 'No decks yet',
          description: ['Create one or import a deck code below.'],
        },
        h,
      ),
    onNonEmpty: nonEmpty =>
      h.ul(
        [h.AriaLabel('Your decks'), h.Class('flex flex-col gap-2')],
        Array.map(nonEmpty, deck =>
          h.keyed('li')(
            deck.id,
            [
              h.Class(
                'flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3',
              ),
            ],
            [
              Link.view(
                { href: deckRouter({ deckId: deck.id }), content: [deck.name] },
                h,
              ),
              h.span(
                [h.Class('text-sm text-fg-muted tabular-nums')],
                [cardCount(deck)],
              ),
            ],
          ),
        ),
      ),
  })

const newDeckView = (
  model: Model,
  ready: typeof DecksState.Model.Ready.Type,
  h: HtmlBuilder<Message>,
): Html =>
  h.form(
    [
      h.AriaLabel('New deck'),
      h.Class('flex flex-col gap-3'),
      h.Novalidate(true),
      h.OnSubmit(Message.SubmittedNewDeck()),
    ],
    [
      h.h2([h.Class('text-lg font-semibold')], ['New deck']),
      TextField.view(
        {
          id: 'new-deck-name',
          label: 'Name',
          field: model.newName,
          onInput: value => Message.UpdatedNewName({ value }),
        },
        h,
      ),
      ready.creation._tag === 'Failed'
        ? h.p(
            [h.Role('alert'), h.Class('text-sm text-danger')],
            ['The deck could not be created. Try again.'],
          )
        : h.empty,
      h.div(
        [],
        [
          Button.view(
            {
              content: ['Create deck'],
              type: 'submit',
              isDisabled: ready.creation._tag === 'Creating',
            },
            h,
          ),
        ],
      ),
    ],
  )

const importView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.form(
    [
      h.AriaLabel('Import a deck code'),
      h.Class('flex flex-col gap-3'),
      h.Novalidate(true),
      h.OnSubmit(Message.SubmittedImport()),
    ],
    [
      h.h2([h.Class('text-lg font-semibold')], ['Import a deck code']),
      TextField.view(
        {
          id: 'import-deck-name',
          label: 'Name',
          field: model.importName,
          onInput: value => Message.UpdatedImportName({ value }),
        },
        h,
      ),
      TextField.view(
        {
          id: 'import-deck-code',
          label: 'Deck code',
          field: model.importCode,
          onInput: value => Message.UpdatedImportCode({ value }),
          autocomplete: 'off',
        },
        h,
      ),
      model.import._tag === 'Failed'
        ? h.p(
            [h.Role('alert'), h.Class('text-sm text-danger')],
            [problemText(model.import.problem)],
          )
        : h.empty,
      h.div(
        [],
        [
          Button.view(
            {
              content: ['Import'],
              type: 'submit',
              variant: 'Secondary',
              isDisabled: model.import._tag === 'Reading',
            },
            h,
          ),
        ],
      ),
    ],
  )

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, { decks }, h) =>
    h.section(
      [h.Class('flex flex-col gap-8')],
      [
        h.h1([h.Class('text-2xl font-semibold')], ['Decks']),
        DecksState.Model.match(decks, {
          NotLoaded: () =>
            Notice.view({ title: 'Loading your decks…', description: [] }, h),
          Loading: () =>
            Notice.view({ title: 'Loading your decks…', description: [] }, h),
          Failed: () =>
            Notice.view(
              {
                title: 'Your decks could not be loaded',
                description: ['Check your connection and try again.'],
                variant: 'Error',
                actions: [
                  Button.view(
                    {
                      content: ['Try again'],
                      onClick: Message.ClickedRetryLoadDecks(),
                    },
                    h,
                  ),
                ],
              },
              h,
            ),
          Ready: ready =>
            h.div(
              [h.Class('grid gap-8 lg:grid-cols-[1fr_22rem]')],
              [
                listView(ready.decks, h),
                h.div(
                  [h.Class('flex flex-col gap-8')],
                  [newDeckView(model, ready, h), importView(model, h)],
                ),
              ],
            ),
        }),
      ],
    ),
)
