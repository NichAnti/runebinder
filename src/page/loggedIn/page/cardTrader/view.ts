import { Option } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Button, Notice } from '../../../../ui'
import * as CardTraderState from '../../cardTrader'

type Message = CardTraderState.Message
const { Message } = CardTraderState

const connectButton = (h: HtmlBuilder<Message>): Html =>
  Button.view(
    { content: ['Connect CardTrader'], onClick: Message.ClickedConnect() },
    h,
  )

const connectedView = (
  isRemembered: boolean,
  maybeAppName: Option.Option<string>,
  h: HtmlBuilder<Message>,
): Html =>
  Notice.view(
    {
      title: 'Connected to CardTrader',
      description: [
        Option.match(maybeAppName, {
          onNone: () => 'Using your stored token. ',
          onSome: appName => `Using the token of the app “${appName}”. `,
        }),
        isRemembered
          ? 'It is remembered on this device until you disconnect or sign out.'
          : 'It is forgotten when you close this tab.',
      ],
      actions: [
        Button.view(
          {
            content: ['Disconnect'],
            variant: 'Secondary',
            onClick: Message.ClickedDisconnect(),
          },
          h,
        ),
      ],
    },
    h,
  )

export const view = Submodel.defineView<CardTraderState.Model, Message>(
  (model, h) =>
    h.section(
      [h.Class('flex max-w-xl flex-col gap-6')],
      [
        h.h1([h.Class('text-2xl font-semibold')], ['CardTrader']),
        CardTraderState.explanationView(h),
        CardTraderState.Connection.match(model.connection, {
          NotChecked: () =>
            Notice.view(
              {
                title: 'Checking your CardTrader connection…',
                description: [],
              },
              h,
            ),
          Checking: () =>
            Notice.view(
              {
                title: 'Checking your CardTrader connection…',
                description: [],
              },
              h,
            ),
          Disconnected: ({ wasRejected }) =>
            wasRejected
              ? Notice.view(
                  {
                    title: 'CardTrader rejected your token',
                    description: [
                      'It was forgotten. Connect again with a new token.',
                    ],
                    variant: 'Error',
                    actions: [connectButton(h)],
                  },
                  h,
                )
              : Notice.view(
                  {
                    title: 'Not connected',
                    description: [
                      'Connect to send wishlists to CardTrader and import from them.',
                    ],
                    actions: [connectButton(h)],
                  },
                  h,
                ),
          Connected: ({ isRemembered, maybeAppName }) =>
            connectedView(isRemembered, maybeAppName, h),
        }),
      ],
    ),
)
