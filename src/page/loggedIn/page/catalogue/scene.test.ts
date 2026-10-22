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

import { CatalogueQuery } from '../../../../domain'
import { allValues, searchResult } from '../../../../testing'
import { Message } from './message'
import { PAGE_SIZE, Results, init } from './model'
import { ReplaceQuery, update } from './update'
import { view } from './view'

const query = CatalogueQuery.empty
const sceneView = withViewInputs(view, { query, allValues })

const showing = modifyFields(init(query), {
  results: () =>
    Results.Showing({ query, limit: PAGE_SIZE, result: searchResult }),
})

describe('catalogue page', () => {
  test('shows the results with their count and links to each card', () => {
    scene(
      { update: update(query), view: sceneView() },
      given(showing),
      expect(text('1 card')).toExist(),
      expect(role('link', { name: /Test Unit/ })).toHaveAttr(
        'href',
        '/cards/test-unit',
      ),
    )
  })

  test('filter values show their counts and disable empty ones', () => {
    scene(
      { update: update(query), view: sceneView() },
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
      { update: update(query), view: sceneView() },
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
