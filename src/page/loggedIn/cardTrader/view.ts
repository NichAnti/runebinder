import { Option, Redacted } from 'effect'
import { Submodel } from 'foldkit'
import { Invalid, NotValidated } from 'foldkit/fieldValidation'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { CardTraderFailure } from '../../../service'
import { Button, Checkbox, Dialog, Link, Notice, TextField } from '../../../ui'
import { Message } from './message'
import { DIALOG_ID, type Model, type TokenProblem } from './model'

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

export const explanationView = <ParentMessage>(
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.div(
    [h.Class('flex flex-col gap-2 text-sm text-fg-muted')],
    [
      h.p(
        [],
        [
          'Your CardTrader API token gives full access to your CardTrader account, including buying. This app only uses it to read your wishlists and to create or delete the wishlists you send.',
        ],
      ),
      h.p(
        [],
        [
          'You find it in the settings page of your CardTrader profile (',
          Link.view(
            {
              href: CARDTRADER_API_DOCS_URL,
              content: ['API docs'],
              isExternal: true,
            },
            h,
          ),
          '). It stays in this browser, is never sent to our server, and is forgotten when you sign out.',
        ],
      ),
    ],
  )

const formView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const value = Redacted.value(model.tokenInput)
  const field = Option.match(model.maybeTokenProblem, {
    onNone: () => NotValidated({ value }),
    onSome: problem => Invalid({ value, errors: [TOKEN_PROBLEMS[problem]] }),
  })
  const isConnecting = model.submission._tag === 'Connecting'

  return h.form(
    [
      h.Class('flex flex-col gap-4'),
      h.Novalidate(true),
      h.OnSubmit(Message.SubmittedConnect()),
    ],
    [
      explanationView(h),
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
      model.submission._tag === 'Failed'
        ? Notice.view(
            {
              title: 'Could not connect',
              description: [FAILURES[model.submission.reason]],
              variant: 'Error',
            },
            h,
          )
        : h.empty,
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

export const view = Submodel.defineView<Model, Message>((model, h) =>
  Dialog.view(
    {
      slotId: DIALOG_ID,
      model: model.dialog,
      toParentMessage: message => Message.GotDialogMessage({ message }),
      title: 'Connect CardTrader',
      description: [
        'Connecting unlocks sending wishlists to CardTrader and importing from them.',
      ],
      body: [formView(model, h)],
    },
    h,
  ),
)
