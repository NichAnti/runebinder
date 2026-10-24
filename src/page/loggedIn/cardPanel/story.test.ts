import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { HoverIntent } from '@foldkit/ui'

import { Printing } from '../../../domain'
import { Message } from './message'
import { Panel, PanelCard, init } from './model'
import { LoadPanelCard, update } from './update'

const vi = Printing.CardId.make('vi')
const jinx = Printing.CardId.make('jinx')

const openHoverIntent = (isTriggerHovered: boolean): HoverIntent.Model => ({
  ...HoverIntent.init(),
  isOpen: true,
  isTriggerHovered,
})

const hoveredOpen = (cardId: Printing.CardId) =>
  modifyFields(init(), {
    hoverIntent: () => openHoverIntent(true),
    panel: () =>
      Panel.Open({
        cardId,
        tileId: cardId,
        opener: 'Hover',
        card: PanelCard.Loading(),
      }),
  })

describe('card panel', () => {
  test('two tiles of the same card open only the hovered one, without reloading', () => {
    story(
      update,
      given(hoveredOpen(vi)),
      message(
        Message.GotHoverIntentMessage({
          cardId: vi,
          tileId: 'second-tile',
          message: HoverIntent.Message.EnteredTrigger(),
        }),
      ),
      model(next => {
        expect(next.panel._tag === 'Open' ? next.panel.tileId : 'closed').toBe(
          'second-tile',
        )
      }),
      Command.expectNone(),
    )
  })

  test('moving to another card while hovering shows that card', () => {
    story(
      update,
      given(hoveredOpen(vi)),
      message(
        Message.GotHoverIntentMessage({
          cardId: jinx,
          tileId: jinx,
          message: HoverIntent.Message.EnteredTrigger(),
        }),
      ),
      model(next => {
        expect(next.panel._tag === 'Open' && next.panel.cardId).toBe(jinx)
      }),
      Command.expectHas(LoadPanelCard),
      Command.resolveAll([LoadPanelCard, Message.SkippedLoadPanelCard()]),
    )
  })

  test('a clicked panel stays open when the pointer leaves', () => {
    const pinned = modifyFields(hoveredOpen(vi), {
      hoverIntent: () => openHoverIntent(false),
      panel: () =>
        Panel.Open({
          cardId: vi,
          tileId: vi,
          opener: 'Click',
          card: PanelCard.Loading(),
        }),
    })

    story(
      update,
      given(pinned),
      message(
        Message.GotHoverIntentMessage({
          cardId: vi,
          tileId: vi,
          message: HoverIntent.Message.CompletedWaitBeforeClosing({
            version: pinned.hoverIntent.pendingCloseVersion,
          }),
        }),
      ),
      model(next => {
        expect(next.panel._tag).toBe('Open')
      }),
    )
  })
})
