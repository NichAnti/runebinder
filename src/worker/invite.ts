import { Array, Effect, Option, Redacted } from 'effect'

import { AUTH_BASE_PATH } from './auth'

const SIGN_UP_PATH = `${AUTH_BASE_PATH}/sign-up`

const withoutTrailingSlashes = (pathname: string): string =>
  pathname.replace(/\/+$/, '')

export const isSignUpPath = (pathname: string): boolean => {
  const path = withoutTrailingSlashes(pathname)

  return path === SIGN_UP_PATH || path.startsWith(`${SIGN_UP_PATH}/`)
}

const digestOf = (value: string) =>
  Effect.promise(() =>
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  ).pipe(Effect.map(buffer => new Uint8Array(buffer)))

// Compares digests of equal length byte by byte without stopping early, so the
// time taken does not reveal how much of a guess was right.
const isSameSecret = (left: Uint8Array, right: Uint8Array): boolean =>
  Array.reduce(
    Array.zip(Array.fromIterable(left), Array.fromIterable(right)),
    0,
    (difference, [a, b]) => difference | (a ^ b),
  ) === 0

export const isInviteCodeValid = (
  expected: Redacted.Redacted<string>,
  maybeGiven: Option.Option<string>,
): Effect.Effect<boolean> =>
  Option.match(maybeGiven, {
    onNone: () => Effect.succeed(false),
    onSome: given =>
      Effect.zipWith(
        digestOf(Redacted.value(expected)),
        digestOf(given),
        isSameSecret,
      ),
  })
