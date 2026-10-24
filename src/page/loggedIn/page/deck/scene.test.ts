import { Option } from 'effect'
import {
  Command,
  Mount,
  change,
  click,
  expect,
  expectOutMessage,
  given,
  role,
  scene,
  selector,
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
  ScrollToSidePanel,
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
  test('at the limit, adding to the sideboard moves a copy over', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(asList),
      expect(mainDeck).toContainText('3× Test Unit, Tester'),
      click(
        within(
          mainDeck,
          within(
            role('group', { name: 'In Sideboard: Test Unit, Tester' }),
            role('button', { name: 'Add one' }),
          ),
        ),
      ),
      expectOutMessage(
        OutMessage.EditedDeck({
          deckId: deck.id,
          edits: [
            { _tag: 'StepCopies', zone: 'Main', printingId: base, step: -1 },
            {
              _tag: 'StepCopies',
              zone: 'Sideboard',
              printingId: base,
              step: 1,
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

  test('a line opens the same card panel as the cards page', () => {
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
          role('group', { name: 'Owned: Standard TST-001/010' }),
          role('status'),
        ),
      ).toHaveText('1'),
      click(
        within(
          role('group', { name: 'Owned: Alternate art TST-001a/010' }),
          role('button', { name: 'Add one' }),
        ),
      ),
      expectOutMessage(
        OutMessage.SteppedOwned({ printingId: alternate, step: 1 }),
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

  test('a tile in the grid cannot go past the limit but can go down', () => {
    const counter = within(
      mainDeck,
      role('group', { name: 'In Main deck: Test Unit, Tester' }),
    )

    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      expect(
        within(counter, role('button', { name: 'Add one' })),
      ).toBeDisabled(),
      click(within(counter, role('button', { name: 'Remove one' }))),
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
      sidePanel: () => 'Add',
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

  test('a search result not in the deck yet loads its card and adds it', () => {
    const emptyDeck: Deck.Deck = { ...deck, contents: Deck.empty }

    scene(
      {
        update: update(Option.some(emptyDeck)),
        view: withViewInputs(view, {
          decks: DecksState.Model.Ready({
            decks: [emptyDeck],
            saves: {},
            nextRevision: 0,
            creation: DecksState.Creation.Idle(),
            removals: {},
          }),
          deckId: deck.id,
          collection: CollectionState.init(),
        })(),
      },
      given(
        modifyFields(loaded, {
          searchResults: () => searchResult.cards,
          sidePanel: () => 'Add',
        }),
      ),
      click(
        within(
          role('group', { name: 'In Main deck: Test Unit, Tester' }),
          role('button', { name: 'Add one' }),
        ),
      ),
      Command.expectExact(LoadCardToAdd),
      Command.resolve(
        LoadCardToAdd,
        Message.SucceededLoadCardToAdd({
          card: testCard,
          tab: 'Unit',
          target: 'Deck',
        }),
      ),
    )
  })
  test('a search result adds a copy to the sideboard too, within the limit', () => {
    const twoCopies: Deck.Deck = {
      ...deck,
      contents: {
        ...deck.contents,
        main: [{ printingId: base, copies: Deck.Copies.make(2) }],
      },
    }
    const sideboard = within(
      role('complementary', { name: 'Deck tools' }),
      role('group', { name: 'In Sideboard: Test Unit, Tester' }),
    )

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
      given(
        modifyFields(loaded, {
          searchResults: () => searchResult.cards,
          sidePanel: () => 'Add',
        }),
      ),
      expect(within(sideboard, role('status'))).toHaveText('0'),
      click(within(sideboard, role('button', { name: 'Add one' }))),
      expectOutMessage(
        OutMessage.EditedDeck({
          deckId: deck.id,
          edits: [
            {
              _tag: 'StepCopies',
              zone: 'Sideboard',
              printingId: base,
              step: 1,
            },
          ],
        }),
      ),
    )
  })

  test('the main deck is grouped by type and the stats tab shows its curve', () => {
    const tools = role('complementary', { name: 'Deck tools' })

    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      expect(role('tab', { name: 'Deck stats' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(within(tools, role('list', { name: 'Energy curve' }))).toExist(),
      expect(
        within(tools, role('listitem', { name: '3 energy: 3 cards' })),
      ).toExist(),
      expect(within(mainDeck, role('group', { name: 'Units' }))).toContainText(
        'Test Unit',
      ),
    )
  })

  test('the main deck placeholder sits after its last cards', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      expect(
        within(
          within(mainDeck, role('group', { name: 'Units' })),
          role('button', { name: 'Spells' }),
        ),
      ).toExist(),
    )
  })

  test('a placeholder opens the add tab with that kind of card', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      click(
        within(
          role('region', { name: 'Battlefields' }),
          role('button', { name: 'Battlefields' }),
        ),
      ),
      Command.expectExact(SearchCardsToAdd, ScrollToSidePanel),
      Command.resolve(
        SearchCardsToAdd,
        Message.SucceededSearchCardsToAdd({
          term: '',
          tab: 'Battlefield',
          cards: [],
        }),
      ),
      Command.resolve(ScrollToSidePanel, Message.CompletedScrollToSidePanel()),
      expect(role('tab', { name: 'Add cards' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(role('button', { name: 'Battlefields', pressed: true })).toExist(),
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

  test('grid tiles offer Make champion and no move buttons', () => {
    scene(
      { update: update(Option.some(deck)), view: sceneView() },
      given(loaded),
      expect(
        within(mainDeck, role('button', { name: 'Make champion' })),
      ).toExist(),
      expect(
        within(mainDeck, role('button', { name: 'To sideboard' })),
      ).not.toExist(),
    )
  })
  test('each version is its own tile and can be switched', () => {
    const mixed: Deck.Deck = {
      ...deck,
      contents: {
        ...deck.contents,
        main: [
          { printingId: base, copies: Deck.Copies.make(2) },
          { printingId: alternate, copies: Deck.Copies.make(1) },
        ],
      },
    }

    scene(
      {
        update: update(Option.some(mixed)),
        view: withViewInputs(view, {
          decks: DecksState.Model.Ready({
            decks: [mixed],
            saves: {},
            nextRevision: 0,
            creation: DecksState.Creation.Idle(),
            removals: {},
          }),
          deckId: deck.id,
          collection: CollectionState.init(),
        })(),
      },
      given(asList),
      expect(mainDeck).toContainText('2× Test Unit, Tester'),
      expect(mainDeck).toContainText('1× Test Unit, Tester'),
      change(within(mainDeck, selector(`#version-Main-${alternate}`)), base),
      expectOutMessage(
        OutMessage.EditedDeck({
          deckId: deck.id,
          edits: [
            {
              _tag: 'StepCopies',
              zone: 'Main',
              printingId: alternate,
              step: -1,
            },
            { _tag: 'StepCopies', zone: 'Main', printingId: base, step: 1 },
          ],
        }),
      ),
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
