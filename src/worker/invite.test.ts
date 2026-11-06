import { Effect, Option, Redacted } from 'effect'

import { assert, describe, it } from '@effect/vitest'

import { isInviteCodeValid, isSignUpPath } from './invite'

const code = Redacted.make('riftbound-friends-2026')

describe('isSignUpPath', () => {
  it.each([
    '/api/auth/sign-up/email',
    '/api/auth/sign-up/email/',
    '/api/auth/sign-up',
  ])('%s is a sign-up', pathname => {
    assert.isTrue(isSignUpPath(pathname))
  })

  it.each(['/api/auth/sign-in/email', '/api/auth/get-session', '/api/decks'])(
    '%s is not a sign-up',
    pathname => {
      assert.isFalse(isSignUpPath(pathname))
    },
  )
})

describe('isInviteCodeValid', () => {
  it.effect('accepts the exact code', () =>
    Effect.gen(function* () {
      assert.isTrue(
        yield* isInviteCodeValid(code, Option.some('riftbound-friends-2026')),
      )
    }),
  )

  it.effect('rejects a wrong, partial or missing code', () =>
    Effect.gen(function* () {
      assert.isFalse(yield* isInviteCodeValid(code, Option.some('riftbound')))
      assert.isFalse(
        yield* isInviteCodeValid(code, Option.some('Riftbound-friends-2026')),
      )
      assert.isFalse(yield* isInviteCodeValid(code, Option.some('')))
      assert.isFalse(yield* isInviteCodeValid(code, Option.none()))
    }),
  )
})
