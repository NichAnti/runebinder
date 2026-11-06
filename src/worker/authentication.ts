import { RuntimeContext } from 'alchemy'
import { Effect, Layer, Schema } from 'effect'

import {
  Authentication,
  AuthenticationUnavailable,
  CurrentUser,
  Unauthorized,
} from '../api'
import { User } from '../domain'
import { Auth } from './auth'

export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const auth = yield* Auth

    return httpEffect =>
      Effect.gen(function* () {
        const session = yield* auth.getSession().pipe(
          Effect.mapError(() => new AuthenticationUnavailable()),
          Effect.catchDefect(() =>
            Effect.fail(new AuthenticationUnavailable()),
          ),
        )

        if (session === null) {
          return yield* new Unauthorized()
        }

        const user = yield* Schema.decodeEffect(User.User)(session.user).pipe(
          Effect.mapError(() => new AuthenticationUnavailable()),
        )

        return yield* Effect.provideService(httpEffect, CurrentUser, user)
      }).pipe(Effect.provide(RuntimeContext.phantom))
  }),
)
