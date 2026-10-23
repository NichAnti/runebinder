import { Effect, Schema } from 'effect'
import { Mount } from 'foldkit'

import { Anchor } from '@foldkit/ui'

import { Message } from './message'

const PANEL_GAP = 8
const VIEWPORT_PADDING = 16

export const AnchorCardPanel = Mount.define('AnchorCardPanel', {
  args: { buttonId: Schema.String, isFocused: Schema.Boolean },
  messages: [Message.CompletedAnchorCardPanel],
  execute: ({ element, buttonId, isFocused }) =>
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          Anchor.anchorSetup(element, {
            buttonId,
            anchor: {
              placement: 'right-start',
              gap: PANEL_GAP,
              padding: VIEWPORT_PADDING,
              portal: true,
            },
            interceptTab: false,
            focusAfterPosition: isFocused,
          }),
        ),
        cleanup => Effect.sync(cleanup),
      )
      return Message.CompletedAnchorCardPanel()
    }),
})
