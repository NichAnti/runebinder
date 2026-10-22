import { createAuthClient } from 'better-auth/client'
import { Context, Effect, Layer, Match, Option, Schema } from 'effect'

import { User } from '../domain'

export const FailureReason = Schema.Literals([
  'InvalidCredentials',
  'EmailTaken',
  'WeakPassword',
  'Unknown',
])
export type FailureReason = typeof FailureReason.Type

export class AuthError extends Schema.TaggedError<AuthError>()('AuthError', {
  reason: FailureReason,
}) {}

export type SignUpInput = Readonly<{
  name: string
  email: string
  password: string
}>

export type SignInInput = Readonly<{
  email: string
  password: string
}>

type Result<A> = Readonly<{
  data: A | null
  error: Readonly<{ code?: string | undefined }> | null
}>

export const reasonFor = (code: Option.Option<string>): FailureReason =>
  Option.match(code, {
    onNone: () => 'Unknown',
    onSome: code =>
      Match.value(code).pipe(
        Match.withReturnType<FailureReason>(),
        Match.when('INVALID_EMAIL_OR_PASSWORD', () => 'InvalidCredentials'),
        Match.when('USER_ALREADY_EXISTS', () => 'EmailTaken'),
        Match.when('USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', () => 'EmailTaken'),
        Match.when('PASSWORD_TOO_SHORT', () => 'WeakPassword'),
        Match.when('PASSWORD_TOO_LONG', () => 'WeakPassword'),
        Match.orElse(() => 'Unknown'),
      ),
  })

const run = <A>(call: () => Promise<Result<A>>): Effect.Effect<A, AuthError> =>
  Effect.tryPromise({
    try: call,
    catch: () => new AuthError({ reason: 'Unknown' }),
  }).pipe(
    Effect.flatMap(({ data, error }) =>
      Option.match(Option.fromNullishOr(data), {
        onNone: () =>
          Effect.fail(
            new AuthError({
              reason: reasonFor(Option.fromNullishOr(error?.code)),
            }),
          ),
        onSome: Effect.succeed,
      }),
    ),
  )

const decodeUser = (user: unknown): Effect.Effect<User.User, AuthError> =>
  Schema.decodeUnknownEffect(User.User)(user).pipe(
    Effect.mapError(() => new AuthError({ reason: 'Unknown' })),
  )

export class AuthClient extends Context.Service<
  AuthClient,
  {
    readonly signUp: (input: SignUpInput) => Effect.Effect<User.User, AuthError>
    readonly signIn: (input: SignInInput) => Effect.Effect<User.User, AuthError>
    readonly signOut: Effect.Effect<void, AuthError>
  }
>()('cardtrader/service/AuthClient') {
  static readonly layer = Layer.sync(AuthClient, () => {
    const client = createAuthClient()

    return AuthClient.of({
      signUp: Effect.fn('AuthClient.signUp')(function* (input) {
        const data = yield* run(() => client.signUp.email(input))
        return yield* decodeUser(data.user)
      }),
      signIn: Effect.fn('AuthClient.signIn')(function* (input) {
        const data = yield* run(() => client.signIn.email(input))
        return yield* decodeUser(data.user)
      }),
      signOut: run(() => client.signOut()).pipe(Effect.asVoid),
    })
  })
}
