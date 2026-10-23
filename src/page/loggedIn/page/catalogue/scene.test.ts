import { Option } from 'effect'
import {
  Command,
  click,
  expect,
  given,
  role,
  scene,
  text,
  withViewInputs,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { CatalogueQuery, Collection, Printing } from '../../../../domain'
import { allValues, searchResult } from '../../../../testing'
import * as CollectionState from '../../collection'
import { Message } from './message'
import { PAGE_SIZE, Results, init } from './model'
import { type Context, ReplaceQuery, update } from './update'
import { view } from './view'

const query = CatalogueQuery.empty

const inCatalogue = (
  query: CatalogueQuery.Query,
  maybeOwned: Option.Option<Collection.Owned> = Option.none(),
): Context => ({ query, maybeOwned, maybeWanted: Option.none() })
const vi = Printing.PrintingId.make('tst-001-010')
const printingSets = { [vi]: Printing.SetCode.make('TST') }
const sceneView = withViewInputs(view, {
  query,
  allValues,
  printingSets,
  maybeWanted: Option.none(),
  collection: CollectionState.init(),
})

const showing = modifyFields(init(query), {
  results: () =>
    Results.Showing({ query, limit: PAGE_SIZE, result: searchResult }),
})

describe('catalogue page', () => {
  test('shows the results with their count, each card opening its panel', () => {
    scene(
      { update: update(inCatalogue(query)), view: sceneView() },
      given(showing),
      expect(text('1 card')).toExist(),
      expect(role('button', { name: /Test Unit/ })).toHaveAttr(
        'aria-haspopup',
        'dialog',
      ),
      expect(role('heading', { name: 'Cards' })).toExist(),
      expect(role('button', { name: 'All cards', pressed: true })).toExist(),
      expect(role('region', { name: 'Collection summary' })).not.toExist(),
    )
  })

  test('the switch chooses between all cards, the collection and missing ones', () => {
    scene(
      { update: update(inCatalogue(query)), view: sceneView() },
      given(showing),
      click(role('button', { name: 'My collection' })),
      Command.expectHas(
        ReplaceQuery({ query: { ...query, ownership: 'Owned' } }),
      ),
      Command.resolve(ReplaceQuery, Message.CompletedReplaceQuery()),
    )
  })

  test('my collection shows its summary', () => {
    const ownedQuery: CatalogueQuery.Query = { ...query, ownership: 'Owned' }

    scene(
      {
        update: update(inCatalogue(ownedQuery)),
        view: withViewInputs(view, {
          query: ownedQuery,
          allValues,
          printingSets,
          maybeWanted: Option.none(),
          collection: CollectionState.Model.Ready({
            owned: { [vi]: Collection.OwnedQuantity.make(2) },
            saves: {},
            nextRevision: 0,
          }),
        })(),
      },
      given(showing),
      expect(role('region', { name: 'Collection summary' })).toContainText(
        'TST 1 / 1',
      ),
      expect(role('button', { name: 'Refresh' })).not.toExist(),
    )
  })

  test('Wanted shows what is needed and each card says how many', () => {
    const wantedQuery: CatalogueQuery.Query = { ...query, ownership: 'Wanted' }

    scene(
      {
        update: update(inCatalogue(wantedQuery)),
        view: withViewInputs(view, {
          query: wantedQuery,
          allValues,
          printingSets,
          collection: CollectionState.Model.Ready({
            owned: { [vi]: Collection.OwnedQuantity.make(1) },
            saves: {},
            nextRevision: 0,
          }),
          maybeWanted: Option.some({
            copies: { [vi]: 2 },
            fromDecks: 2,
            fromCustom: 0,
          }),
        })(),
      },
      given(showing),
      expect(role('region', { name: 'Wanted summary' })).toContainText(
        'Missing from decks',
      ),
      expect(text('Owned 1')).toExist(),
      expect(text('Need 2')).toExist(),
      expect(role('button', { name: 'Not owned' })).not.toExist(),
    )
  })

  test('each card shows how many copies are owned across its printings', () => {
    const ownedView = withViewInputs(view, {
      query,
      allValues,
      printingSets,
      maybeWanted: Option.none(),
      collection: CollectionState.Model.Ready({
        owned: {
          [Printing.PrintingId.make('tst-001-010')]:
            Collection.OwnedQuantity.make(2),
          [Printing.PrintingId.make('tst-001a-010')]:
            Collection.OwnedQuantity.make(1),
        },
        saves: {},
        nextRevision: 0,
      }),
    })

    scene(
      { update: update(inCatalogue(query)), view: ownedView() },
      given(showing),
      expect(text('Owned 3')).toExist(),
    )
  })

  test('an empty collection offers to show all cards', () => {
    const ownedQuery: CatalogueQuery.Query = { ...query, ownership: 'Owned' }
    const collectionView = withViewInputs(view, {
      query: ownedQuery,
      allValues,
      printingSets,
      maybeWanted: Option.none(),
      collection: CollectionState.Model.Ready({
        owned: {},
        saves: {},
        nextRevision: 0,
      }),
    })

    scene(
      {
        update: update(inCatalogue(ownedQuery, Option.some({}))),
        view: collectionView(),
      },
      given(
        modifyFields(showing, {
          results: () =>
            Results.Showing({
              query,
              limit: PAGE_SIZE,
              result: { ...searchResult, total: 0, cards: [] },
            }),
        }),
      ),
      expect(text('Your collection is empty')).toExist(),
      click(role('button', { name: 'Show all cards' })),
      Command.expectHas(
        ReplaceQuery({ query: { ...ownedQuery, ownership: 'All' } }),
      ),
      Command.resolve(ReplaceQuery, Message.CompletedReplaceQuery()),
    )
  })

  test('filter values show their counts and disable empty ones', () => {
    scene(
      { update: update(inCatalogue(query)), view: sceneView() },
      given(showing),
      expect(role('button', { name: 'Fury 1' })).toHaveAttr(
        'aria-pressed',
        'false',
      ),
      expect(role('button', { name: 'Spell 0' })).toBeDisabled(),
    )
  })

  test('no results offers to clear the filters', () => {
    scene(
      { update: update(inCatalogue(query)), view: sceneView() },
      given(
        modifyFields(showing, {
          results: () =>
            Results.Showing({
              query,
              limit: PAGE_SIZE,
              result: { ...searchResult, total: 0, cards: [] },
            }),
        }),
      ),
      expect(role('status')).toContainText('No cards match'),
      click(role('button', { name: 'Clear filters' })),
      Command.expectExact(ReplaceQuery),
      Command.resolve(ReplaceQuery, Message.CompletedReplaceQuery()),
    )
  })
})
