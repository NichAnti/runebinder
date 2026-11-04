import { Match } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineTaggedUnion } from 'foldkit/schema'

import { FailureReason } from '../../service'

export const Submission = defineTaggedUnion({
  Idle: {},
  Submitting: {},
  Failed: { reason: FailureReason },
})
export type Submission = typeof Submission.Type

const failureText = (reason: FailureReason): string =>
  Match.value(reason).pipe(
    Match.withReturnType<string>(),
    Match.when('InvalidCredentials', () => 'Email or password is incorrect.'),
    Match.when(
      'EmailTaken',
      () => 'An account with this email already exists.',
    ),
    Match.when(
      'WeakPassword',
      () => 'Choose a password of at least 8 characters.',
    ),
    Match.when(
      'InvalidInviteCode',
      () =>
        'This invite code is not valid. Check it with the person who sent it.',
    ),
    Match.when('Unknown', () => 'Something went wrong. Please try again.'),
    Match.exhaustive,
  )

export const failureView = <Message>(
  submission: Submission,
  h: HtmlBuilder<Message>,
): Html =>
  Submission.match(submission, {
    Idle: () => h.empty,
    Submitting: () => h.empty,
    Failed: ({ reason }) =>
      h.p(
        [h.Role('alert'), h.Class('text-sm text-danger')],
        [failureText(reason)],
      ),
  })
