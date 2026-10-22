import * as Cloudflare from 'alchemy/Cloudflare'
import { drizzle } from 'drizzle-orm/d1'
import { Context, Effect, Layer } from 'effect'

import { BetterAuth } from '@alchemy.run/better-auth'
import { Drizzle } from '@alchemy.run/better-auth/Drizzle'

import { AppDb } from './database'
import * as schema from './schema'

export const AUTH_BASE_PATH = '/api/auth'

const makeAuth = BetterAuth({
  basePath: AUTH_BASE_PATH,
  emailAndPassword: { enabled: true },
})

/** @effect-expect-leaking RuntimeContext */
export class Auth extends Context.Service<
  Auth,
  Effect.Success<typeof makeAuth>
>()('cardtrader/worker/Auth') {}

const AuthDatabase = Layer.unwrap(
  Effect.gen(function* () {
    const d1 = yield* Cloudflare.D1.QueryDatabase(AppDb)

    return Drizzle(
      Effect.map(d1.raw, binding =>
        drizzle(binding, { relations: schema.authRelations }),
      ),
      { provider: 'sqlite', schema },
    )
  }),
).pipe(Layer.provide(Cloudflare.D1.QueryDatabaseBinding))

export const AuthLive = Layer.effect(Auth, makeAuth).pipe(
  Layer.provide(AuthDatabase),
)
