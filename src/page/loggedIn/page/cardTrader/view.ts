import { Option, Redacted } from 'effect'
import { Submodel } from 'foldkit'
import { Invalid, NotValidated } from 'foldkit/fieldValidation'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { CardTraderFailure } from '../../../../service'
import { Button, Checkbox, Link, Notice, TextField } from '../../../../ui'
import { Message } from './message'
import { Connection, type Model, type TokenProblem } from './model'

const CARDTRADER_API_DOCS_URL =
  'https://www.cardtrader.com/docs/api/full/reference'

const TOKEN_PROBLEMS: Readonly<Record<TokenProblem, string>> = {
  Missing: 'Paste your CardTrader API token',
  Malformed: 'This does not look like a CardTrader API token',
}

const FAILURES: Readonly<Record<CardTraderFailure, string>> = {
  InvalidToken: 'CardTrader rejected this token. Check it and try again.',
  RateLimited: 'CardTrader is limiting requests. Wait a moment and try again.',
  Unavailable: 'CardTrader could not be reached. Try again later.',
}

const explanationView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex flex-col gap-2 text-sm text-fg-muted')],
    [
      h.p(
        [],
        [
          'Your CardTrader API token gives full access to your CardTrader account, including buying. This app only uses it to read card data and to create or delete the wishlists it sends.',
        ],
      ),
      h.p(
        [],
        [
          'You find it in the settings page of your CardTrader profile (',
          Link.view(
            { href: CARDTRADER_API_DOCS_URL, content: ['API docs'] },
            h,
          ),
          '). It stays in this browser, is never sent to our server, and is forgotten when you sign out.',
        ],
      ),
    ],
  )

const formView = (
  model: Model,
  maybeFailure: Option.Option<CardTraderFailure>,
  h: HtmlBuilder<Message>,
): Html => {
  const value = Redacted.value(model.tokenInput)
  const field = Option.match(model.maybeTokenProblem, {
    onNone: () => NotValidated({ value }),
    onSome: problem => Invalid({ value, errors: [TOKEN_PROBLEMS[problem]] }),
  })
  const isConnecting = model.connection._tag === 'Connecting'

  return h.form(
    [
      h.Class('flex flex-col gap-4'),
      h.Novalidate(true),
      h.OnSubmit(Message.SubmittedConnect()),
    ],
    [
      TextField.view(
        {
          id: 'cardtrader-token',
          label: 'API token',
          type: 'password',
          autocomplete: 'off',
          field,
          onInput: raw => Message.UpdatedToken({ value: Redacted.make(raw) }),
        },
        h,
      ),
      Checkbox.view(
        {
          id: 'cardtrader-remember',
          label: 'Remember on this device',
          description:
            'Otherwise the token is forgotten when you close this tab.',
          isChecked: model.isRemembered,
          onToggle: isChecked => Message.ToggledRemember({ isChecked }),
        },
        h,
      ),
      Option.match(maybeFailure, {
        onNone: () => h.empty,
        onSome: failure =>
          Notice.view(
            {
              title: 'Could not connect',
              description: [FAILURES[failure]],
              variant: 'Error',
            },
            h,
          ),
      }),
      h.div(
        [],
        [
          Button.view(
            {
              content: [isConnecting ? 'Connecting…' : 'Connect'],
              type: 'submit',
              isDisabled: isConnecting,
            },
            h,
          ),
        ],
      ),
    ],
  )
}

const connectedView = (
  appName: string,
  isRemembered: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  Notice.view(
    {
      title: 'Connected to CardTrader',
      description: [
        `Using the token of the app “${appName}”. `,
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

export const view = Submodel.defineView<Model, Message>((model, h) =>
  h.section(
    [h.Class('flex max-w-xl flex-col gap-6')],
    [
      h.h1([h.Class('text-2xl font-semibold')], ['CardTrader']),
      explanationView(h),
      Connection.match(model.connection, {
        Checking: () =>
          Notice.view(
            { title: 'Checking your CardTrader connection…', description: [] },
            h,
          ),
        Disconnected: () => formView(model, Option.none(), h),
        Connecting: () => formView(model, Option.none(), h),
        Connected: ({ appName, isRemembered }) =>
          connectedView(appName, isRemembered, h),
        Failed: ({ reason }) => formView(model, Option.some(reason), h),
      }),
    ],
  ),
)
