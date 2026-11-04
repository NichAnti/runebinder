import { Array, Match, Number, Option } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  Deck,
  type DeckCode,
  DeckRules,
  Missing,
  type Printing,
} from '../../../../domain'
import { deckRouter } from '../../../../route'
import {
  Badge,
  Button,
  Dialog,
  Icon,
  Link,
  Notice,
  TextField,
} from '../../../../ui'
import * as CollectionState from '../../collection'
import * as DecksState from '../../decks'
import { cardsByPrinting } from '../deck/lines'
import { Message } from './message'
import { IMPORT_DIALOG_ID, type Model, NEW_DECK_DIALOG_ID } from './model'

export type ViewInputs = Readonly<{
  decks: DecksState.Model
  collection: CollectionState.Model
}>

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

type DeckSummary = Readonly<{
  maybeLegend: Option.Option<Printing.Printing>
  progress: Option.Option<DeckRules.Progress>
  need: Option.Option<number>
}>

const STATUS: Readonly<
  Record<
    DeckRules.Progress,
    Readonly<{ text: string; icon: Icon.Name; tone: string }>
  >
> = {
  Done: {
    text: 'Follows the rules',
    icon: 'CheckCircle',
    tone: 'text-success',
  },
  Unfinished: {
    text: 'Not finished',
    icon: 'CheckCircle',
    tone: 'text-fg-muted',
  },
  Problem: {
    text: 'Breaks a rule',
    icon: 'ExclamationTriangle',
    tone: 'text-danger',
  },
}

const summaryOf = (
  deck: Deck.Deck,
  model: Model,
  collection: CollectionState.Model,
): DeckSummary => {
  const byPrinting = cardsByPrinting(model.cards)
  const find = (printingId: Printing.PrintingId) =>
    Option.flatMap(Option.fromNullishOr(byPrinting.get(printingId)), card =>
      Array.findFirst(card.printings, ({ id }) => id === printingId),
    )
  const rules = DeckRules.check(deck.contents, find)

  return {
    maybeLegend: Option.flatMap(deck.contents.maybeLegend, find),
    progress:
      rules._tag === 'Checked'
        ? Option.some(DeckRules.progressOf(rules.problems))
        : Option.none(),
    need: Option.map(CollectionState.maybeOwned(collection), owned =>
      Number.sumAll(
        Array.map(Missing.needs([deck], owned), ({ missing }) => missing),
      ),
    ),
  }
}

const progressText = (deck: Deck.Deck): string =>
  `Main ${Deck.mainDeckSize(deck.contents)} / ${DeckRules.CONSTRUCTED_MAIN_DECK_SIZE} · Runes ${Deck.copiesIn(deck.contents.runes)} / ${DeckRules.RUNE_DECK_SIZE} · Battlefields ${Deck.copiesIn(deck.contents.battlefields)} / ${DeckRules.CONSTRUCTED_BATTLEFIELDS}`

const deckCardView = (
  deck: Deck.Deck,
  summary: DeckSummary,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed('li')(
    deck.id,
    [
      h.Class(
        'flex flex-col overflow-hidden rounded-card border border-border bg-surface',
      ),
    ],
    [
      Option.match(summary.maybeLegend, {
        onNone: () => h.div([h.Class('h-32 w-full bg-surface-raised')]),
        onSome: legend =>
          h.img([
            h.Src(legend.imageUrl),
            h.Alt(''),
            h.Loading('lazy'),
            h.Class('h-32 w-full object-cover object-[50%_20%]'),
          ]),
      }),
      h.div(
        [h.Class('flex flex-1 flex-col gap-2 p-4')],
        [
          Link.view(
            {
              href: deckRouter({ deckId: deck.id }),
              content: [deck.name],
            },
            h,
          ),
          Option.match(summary.maybeLegend, {
            onNone: () =>
              h.p([h.Class('text-xs text-fg-muted')], ['No legend yet']),
            onSome: legend =>
              h.div(
                [h.AriaLabel('Domains'), h.Class('flex flex-wrap gap-1.5')],
                Array.map(legend.domains, domain =>
                  Badge.view({ content: [domain], tone: domain }, h),
                ),
              ),
          }),
          h.p(
            [h.Class('text-xs tabular-nums text-fg-muted')],
            [progressText(deck)],
          ),
          h.div(
            [
              h.Class(
                'mt-auto flex flex-wrap items-center justify-between gap-2',
              ),
            ],
            [
              Option.match(summary.progress, {
                onNone: () => h.empty,
                onSome: progress =>
                  h.span(
                    [
                      h.Class(
                        `flex items-center gap-1.5 text-sm ${STATUS[progress].tone}`,
                      ),
                    ],
                    [
                      Icon.view({ name: STATUS[progress].icon, size: 'Small' }),
                      STATUS[progress].text,
                    ],
                  ),
              }),
              Option.match(
                Option.filter(summary.need, need => need > 0),
                {
                  onNone: () => h.empty,
                  onSome: need =>
                    Badge.view(
                      { content: [`Need ${need}`], tone: 'Accent' },
                      h,
                    ),
                },
              ),
            ],
          ),
        ],
      ),
    ],
  )

const listView = (
  model: Model,
  decks: ReadonlyArray<Deck.Deck>,
  collection: CollectionState.Model,
  h: HtmlBuilder<Message>,
): Html =>
  Array.match(decks, {
    onEmpty: () =>
      Notice.view(
        {
          title: 'No decks yet',
          description: ['Create a deck or import a deck code to start.'],
          actions: [
            Button.view(
              { content: ['New deck'], onClick: Message.ClickedNewDeck() },
              h,
            ),
          ],
        },
        h,
      ),
    onNonEmpty: nonEmpty =>
      h.ul(
        [
          h.AriaLabel('Your decks'),
          h.Class('grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4'),
        ],
        Array.map(nonEmpty, deck =>
          deckCardView(deck, summaryOf(deck, model, collection), h),
        ),
      ),
  })

const newDeckView = (
  model: Model,
  ready: typeof DecksState.Model.Ready.Type,
  h: HtmlBuilder<Message>,
): Html =>
  Dialog.view(
    {
      slotId: NEW_DECK_DIALOG_ID,
      model: model.newDeckDialog,
      toParentMessage: message => Message.GotNewDeckDialogMessage({ message }),
      title: 'New deck',
      description: ['Give it a name; you can change it later.'],
      body: [
        h.form(
          [
            h.AriaLabel('New deck'),
            h.Class('flex flex-col gap-3'),
            h.Novalidate(true),
            h.OnSubmit(Message.SubmittedNewDeck()),
          ],
          [
            TextField.view(
              {
                id: 'new-deck-name',
                label: 'Name',
                field: model.newName,
                onInput: value => Message.UpdatedNewName({ value }),
              },
              h,
            ),
            h.div(
              [h.Class('flex justify-end')],
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
        ),
      ],
    },
    h,
  )

const importView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Dialog.view(
    {
      slotId: IMPORT_DIALOG_ID,
      model: model.importDialog,
      toParentMessage: message => Message.GotImportDialogMessage({ message }),
      title: 'Import a deck code',
      description: [
        'Paste a deck code from Piltover Archive or another builder.',
      ],
      body: [
        h.form(
          [
            h.AriaLabel('Import a deck code'),
            h.Class('flex flex-col gap-3'),
            h.Novalidate(true),
            h.OnSubmit(Message.SubmittedImport()),
          ],
          [
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
              [h.Class('flex justify-end')],
              [
                Button.view(
                  {
                    content: ['Import'],
                    type: 'submit',
                    isDisabled: model.import._tag === 'Reading',
                  },
                  h,
                ),
              ],
            ),
          ],
        ),
      ],
    },
    h,
  )

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, { decks, collection }, h) =>
    h.section(
      [h.Class('flex flex-col gap-6')],
      [
        h.div(
          [h.Class('flex flex-wrap items-center justify-between gap-3')],
          [
            h.h1([h.Class('text-2xl font-semibold')], ['Decks']),
            h.div(
              [h.Class('flex gap-2')],
              [
                Button.view(
                  { content: ['New deck'], onClick: Message.ClickedNewDeck() },
                  h,
                ),
                Button.view(
                  {
                    content: ['Import code'],
                    variant: 'Secondary',
                    onClick: Message.ClickedImportCode(),
                  },
                  h,
                ),
              ],
            ),
          ],
        ),
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
              [h.Class('flex flex-col gap-4')],
              [
                ready.creation._tag === 'Failed'
                  ? Notice.view(
                      {
                        title: 'The deck could not be created',
                        description: ['Try again.'],
                        variant: 'Error',
                      },
                      h,
                    )
                  : h.empty,
                listView(model, ready.decks, collection, h),
                newDeckView(model, ready, h),
              ],
            ),
        }),
        importView(model, h),
      ],
    ),
)
