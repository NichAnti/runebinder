import { Option } from 'effect'
import {
  Command,
  Mount,
  click,
  expect,
  expectOutMessage,
  given,
  hover,
  keydown,
  role,
  scene,
  withViewInputs,
  within,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import { HoverIntent } from '@foldkit/ui'

import { Collection, Printing } from '../../../domain'
import { testCard } from '../../../testing'
import * as CollectionState from '../collection'
import { Message, OutMessage } from './message'
import { init } from './model'
import { AnchorCardPanel } from './mount'
import { LoadPanelCard, update } from './update'
import { tileView } from './view'

const collection = CollectionState.Model.Ready({
  owned: {
    [Printing.PrintingId.make('tst-001-010')]: Collection.OwnedQuantity.make(3),
  },
  saves: {},
  nextRevision: 0,
})

const sceneView = withViewInputs(tileView, {
  cardId: testCard.id,
  label: 'Test Unit',
  trigger: {
    _tag: 'Tile',
    tile: {
      imageUrl: 'https://example.com/test-unit.png',
      imageAlt: 'Test Unit artwork',
      title: 'Test Unit',
      maybeSubtitle: Option.none(),
      domains: ['Fury'],
      meta: '2 printings',
      highlights: [],
    },
  },
  counts: CollectionState.countsOf(collection),
})

const tile = role('button', { name: 'Test Unit' })
const panel = role('dialog', { name: 'Test Unit' })

const loaded = Command.resolve(
  LoadPanelCard,
  Message.SucceededLoadPanelCard({
    cardId: testCard.id,
    maybeCard: Option.some(testCard),
  }),
)
const anchored = Mount.resolve(
  AnchorCardPanel,
  Message.CompletedAnchorCardPanel(),
)

describe('card panel', () => {
  test('a click opens every printing with its owned amount', () => {
    scene(
      { update, view: sceneView() },
      given(init()),
      expect(panel).not.toExist(),
      click(tile),
      loaded,
      anchored,
      expect(tile).toHaveAttr('aria-expanded', 'true'),
      expect(within(panel, role('status'))).toHaveText('3'),
      expect(
        within(panel, role('link', { name: 'Open card page' })),
      ).toHaveAttr('href', '/cards/test-unit'),
      click(
        within(
          role('group', { name: 'Owned: Alternate art TST-001a/010' }),
          role('button', { name: 'Add one' }),
        ),
      ),
      expectOutMessage(
        OutMessage.SteppedQuantity({
          printingId: Printing.PrintingId.make('tst-001a-010'),
          step: 1,
        }),
      ),
    )
  })

  test('a clicked panel closes with Close or Escape', () => {
    scene(
      { update, view: sceneView() },
      given(init()),
      click(tile),
      loaded,
      anchored,
      click(within(panel, role('button', { name: 'Close' }))),
      Mount.expectEnded(AnchorCardPanel),
      expect(panel).not.toExist(),
      click(tile),
      loaded,
      anchored,
      keydown(panel, 'Escape'),
      Mount.expectEnded(AnchorCardPanel),
      expect(panel).not.toExist(),
    )
  })

  test('hovering opens the panel after a short wait', () => {
    scene(
      { update, view: sceneView() },
      given(init()),
      hover(tile),
      Command.resolve(
        HoverIntent.WaitBeforeOpening,
        HoverIntent.Message.CompletedWaitBeforeOpening({ version: 1 }),
      ),
      loaded,
      anchored,
      expect(panel).toExist(),
    )
  })
})
