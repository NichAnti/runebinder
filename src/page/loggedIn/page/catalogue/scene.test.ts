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
import { ReplaceQuery, update } from './update'
import { view } from './view'

const query = CatalogueQuery.empty
const sceneView = withViewInputs(view, {
  query,
  allValues,
  collection: CollectionState.init(),
})

const showing = modifyFields(init(query), {
  results: () =>
    Results.Showing({ query, limit: PAGE_SIZE, result: searchResult }),
})

describe('catalogue page', () => {
  test('shows the results with their count, each card opening its panel', () => {
    scene(
      { update: update(query, Option.none()), view: sceneView() },
      given(showing),
      expect(text('1 card')).toExist(),
      expect(role('button', { name: /Test Unit/ })).toHaveAttr(
        'aria-haspopup',
        'dialog',
      ),
    )
  })

  test('each card shows how many copies are owned across its printings', () => {
    const ownedView = withViewInputs(view, {
      query,
      allValues,
      collection: CollectionState.Model.Ready({
        owned: {
          [Printing.PrintingId.make('tst-001-010')]:
            Collection.OwnedQuantity.make(2),
          [Printing.PrintingId.make('tst-001a-010')]:
            Collection.OwnedQuantity.make(1),
        },
        saves: {},
        nextRevision: 0,
        refresh: CollectionState.Refresh.Idle(),
      }),
    })

    scene(
      { update: update(query, Option.none()), view: ownedView() },
      given(showing),
      expect(text('Owned 3')).toExist(),
    )
  })

  test('filter values show their counts and disable empty ones', () => {
    scene(
      { update: update(query, Option.none()), view: sceneView() },
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
      { update: update(query, Option.none()), view: sceneView() },
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
