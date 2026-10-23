import { Option } from 'effect'
import {
  Command,
  Mount,
  click,
  expect,
  expectOutMessage,
  given,
  role,
  scene,
  text,
  withViewInputs,
  within,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { Collection, Deck, Printing } from '../../../../domain'
import { searchResult, testCard } from '../../../../testing'
import * as CardPanel from '../../cardPanel'
import * as CollectionState from '../../collection'
import * as DecksState from '../../decks'
import { Message, OutMessage } from './message'
import { type AddTab, init } from './model'
import {
  LoadCardToAdd,
  ScrollToSection,
  SearchCardsToAdd,
  update,
} from './update'
import { view } from './view'

const base = Printing.PrintingId.make('tst-001-010')
const alternate = Printing.PrintingId.make('tst-001a-010')

const deck: Deck.Deck = {
  id: Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11'),
  name: Deck.DeckName.make('Test deck'),
  contents: {
    ...Deck.empty,
    main: [{ printingId: base, copies: Deck.Copies.make(3) }],
  },
}

const decks = DecksState.Model.Ready({
  decks: [deck],
  saves: {},
  nextRevision: 0,
  creation: DecksState.Creation.Idle(),
  removals: {},
})

const sceneView = withViewInputs(view, {
  decks,
  deckId: deck.id,
  collection: CollectionState.init(),
})
const loaded = modifyFields(init(), {
  maybeDeckId: () => Option.some(deck.id),
  cards: () => ({ [testCard.id]: testCard }),
  addTab: (): AddTab => 'Unit',
})
const asList = modifyFields(loaded, { layout: () => 'List' })
const mainDeck = role('region', { name: 'Main deck' })

describe('deck page', () => {
  test('a main deck line can go to the sideboard', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(asList),
      expect(mainDeck).toContainText('3× Test Unit, Tester'),
      click(within(mainDeck, role('button', { name: 'To sideboard' }))),
      expectOutMessage(
        OutMessage.EditedDeck({
          deckId: deck.id,
          edits: [
            {
              _tag: 'MoveCard',
              from: 'Main',
              to: 'Sideboard',
              printingId: base,
            },
          ],
        }),
      ),
    )
  })

  test('a champion in the main deck can become the chosen champion', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(asList),
      click(within(mainDeck, role('button', { name: 'Make champion' }))),
      expectOutMessage(
        OutMessage.EditedDeck({
          deckId: deck.id,
          edits: [{ _tag: 'MakeChampion', printingId: base }],
        }),
      ),
    )
  })

  test('a line opens every printing with its copies in the deck', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(asList),
      click(within(mainDeck, role('button', { name: 'Test Unit, Tester' }))),
      Command.resolve(
        CardPanel.LoadPanelCard,
        CardPanel.Message.SucceededLoadPanelCard({
          cardId: testCard.id,
          maybeCard: Option.some(testCard),
        }),
      ),
      Mount.resolve(
        CardPanel.AnchorCardPanel,
        CardPanel.Message.CompletedAnchorCardPanel(),
      ),
      expect(
        within(
          role('group', { name: 'In deck: Standard TST-001/010' }),
          role('status'),
        ),
      ).toHaveText('3'),
      click(
        within(
          role('group', { name: 'In deck: Alternate art TST-001a/010' }),
          role('button', { name: 'Add one' }),
        ),
      ),
      expectOutMessage(
        OutMessage.EditedDeck({
          deckId: deck.id,
          edits: [
            {
              _tag: 'StepCopies',
              zone: 'Main',
              printingId: alternate,
              step: 1,
            },
          ],
        }),
      ),
    )
  })

  test('each section says what it still needs', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      expect(role('region', { name: 'Legend' })).toContainText(
        'Choose a legend.',
      ),
      expect(mainDeck).toContainText('3/40 ⚠'),
    )
  })

  test('a tile in the grid steps its copies', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      click(
        within(
          role('group', { name: 'Copies: Test Unit, Tester' }),
          role('button', { name: 'Add one' }),
        ),
      ),
      expectOutMessage(
        OutMessage.EditedDeck({
          deckId: deck.id,
          edits: [
            { _tag: 'StepCopies', zone: 'Main', printingId: base, step: 1 },
          ],
        }),
      ),
    )
  })

  test('the progress bar shows each part and jumps to it', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      expect(role('button', { name: 'Main 3/40, not finished' })).toExist(),
      expect(
        role('button', { name: 'Legend to choose, not finished' }),
      ).toExist(),
      click(role('button', { name: 'Runes 0/12, not finished' })),
      Command.expectExact(ScrollToSection, SearchCardsToAdd),
      Command.resolve(ScrollToSection, Message.CompletedScrollToSection()),
      Command.resolve(
        SearchCardsToAdd,
        Message.SucceededSearchCardsToAdd({ term: '', tab: 'Rune', cards: [] }),
      ),
      expect(role('button', { name: 'Runes', pressed: true })).toExist(),
    )
  })

  test('a search result steps its copies up to the limit', () => {
    const withResults = modifyFields(loaded, {
      searchResults: () => searchResult.cards,
    })
    const stepper = role('group', { name: 'In Main deck: Test Unit, Tester' })

    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(withResults),
      expect(within(stepper, role('status'))).toHaveText('3'),
      expect(
        within(stepper, role('button', { name: 'Add one' })),
      ).toBeDisabled(),
      click(within(stepper, role('button', { name: 'Remove one' }))),
      expectOutMessage(
        OutMessage.EditedDeck({
          deckId: deck.id,
          edits: [
            { _tag: 'StepCopies', zone: 'Main', printingId: base, step: -1 },
          ],
        }),
      ),
    )
  })

  test('a search result below the limit adds a copy', () => {
    const twoCopies: Deck.Deck = {
      ...deck,
      contents: {
        ...deck.contents,
        main: [{ printingId: base, copies: Deck.Copies.make(2) }],
      },
    }
    const withResults = modifyFields(loaded, {
      searchResults: () => searchResult.cards,
    })

    scene(
      {
        update: update(Option.some(twoCopies)),
        view: withViewInputs(view, {
          decks: DecksState.Model.Ready({
            decks: [twoCopies],
            saves: {},
            nextRevision: 0,
            creation: DecksState.Creation.Idle(),
            removals: {},
          }),
          deckId: deck.id,
          collection: CollectionState.init(),
        })(),
      },
      given(withResults),
      click(
        within(
          role('group', { name: 'In Main deck: Test Unit, Tester' }),
          role('button', { name: 'Add one' }),
        ),
      ),
      Command.expectExact(LoadCardToAdd),
      Command.resolve(
        LoadCardToAdd,
        Message.SucceededLoadCardToAdd({ card: testCard, tab: 'Unit' }),
      ),
    )
  })

  test('the main deck is grouped by type under its energy curve', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      expect(
        within(mainDeck, role('list', { name: 'Energy curve' })),
      ).toExist(),
      expect(
        within(mainDeck, role('listitem', { name: '3 energy: 3 cards' })),
      ).toExist(),
      expect(within(mainDeck, role('group', { name: 'Units' }))).toContainText(
        'Test Unit',
      ),
    )
  })

  test('each card says how many copies are still needed', () => {
    const owningOne = withViewInputs(view, {
      decks,
      deckId: deck.id,
      collection: CollectionState.Model.Ready({
        owned: { [base]: Collection.OwnedQuantity.make(1) },
        saves: {},
        nextRevision: 0,
      }),
    })

    scene(
      { update: update(Option.some(deck)), view: owningOne() },
      given(loaded),
      expect(within(mainDeck, text('Need 2'))).toExist(),
    )
  })

  test('grid tiles offer the same actions as the list', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      expect(
        within(mainDeck, role('button', { name: 'To sideboard' })),
      ).toExist(),
      expect(
        within(mainDeck, role('button', { name: 'Make champion' })),
      ).toExist(),
    )
  })

  test('deleting asks first', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      click(role('button', { name: 'Delete deck' })),
      click(role('button', { name: 'Delete for good' })),
      expectOutMessage(OutMessage.RequestedRemoveDeck({ deckId: deck.id })),
    )
  })

  test('an unknown deck says so', () => {
    scene(
      {
        update: update(Option.none()),
        view: withViewInputs(view, {
          decks,
          deckId: Deck.DeckId.make('00000000-0000-4000-8000-000000000000'),
          collection: CollectionState.init(),
        })(),
      },
      given(init()),
      expect(role('status')).toContainText('Deck not found'),
    )
  })
})
