import { Valid } from 'foldkit/fieldValidation'
import {
  Command,
  expectNoOutMessage,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { ada } from '../../../testing'
import { Submission } from '../submission'
import { Message, OutMessage, SignIn, init, update } from './signIn'

const filled = modifyFields(init(), {
  email: () => Valid({ value: 'ada@example.com' }),
  password: () => Valid({ value: 'correct horse' }),
})

describe('sign in', () => {
  test('submitting an empty form shows errors and sends nothing', () => {
    story(
      update,
      given(init()),
      message(Message.SubmittedForm()),
      Command.expectNone(),
      expectNoOutMessage(),
      model(next => {
        expect(next.email._tag).toBe('Invalid')
        expect(next.password._tag).toBe('Invalid')
      }),
    )
  })

  test('a successful sign-in reports the user', () => {
    story(
      update,
      given(filled),
      message(Message.SubmittedForm()),
      model(next => {
        expect(next.submission).toStrictEqual(Submission.Submitting())
      }),
      Command.expectExact(SignIn),
      Command.resolve(SignIn, Message.SucceededSignIn({ user: ada })),
      expectOutMessage(OutMessage.SignedIn({ user: ada })),
    )
  })

  test('a rejected sign-in shows the reason', () => {
    story(
      update,
      given(filled),
      message(Message.SubmittedForm()),
      Command.resolve(
        SignIn,
        Message.FailedSignIn({ reason: 'InvalidCredentials' }),
      ),
      model(next => {
        expect(next.submission).toStrictEqual(
          Submission.Failed({ reason: 'InvalidCredentials' }),
        )
      }),
    )
  })
})
