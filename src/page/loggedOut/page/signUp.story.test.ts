import { Valid } from 'foldkit/fieldValidation'
import {
  Command,
  expectNoOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { Submission } from '../submission'
import { Message, SignUp, init, update } from './signUp'

const filled = modifyFields(init(), {
  name: () => Valid({ value: 'Ada' }),
  email: () => Valid({ value: 'ada@example.com' }),
  password: () => Valid({ value: 'correct horse' }),
})

describe('sign up', () => {
  test('an invite code is required', () => {
    story(
      update,
      given(filled),
      message(Message.SubmittedForm()),
      Command.expectNone(),
      expectNoOutMessage(),
      model(next => {
        expect(next.inviteCode._tag).toBe('Invalid')
      }),
    )
  })

  test('a wrong invite code shows the reason', () => {
    story(
      update,
      given(
        modifyFields(filled, {
          inviteCode: () => Valid({ value: 'not-the-code' }),
        }),
      ),
      message(Message.SubmittedForm()),
      Command.expectExact(SignUp),
      Command.resolve(
        SignUp,
        Message.FailedSignUp({ reason: 'InvalidInviteCode' }),
      ),
      model(next => {
        expect(next.submission).toStrictEqual(
          Submission.Failed({ reason: 'InvalidInviteCode' }),
        )
      }),
    )
  })
})
