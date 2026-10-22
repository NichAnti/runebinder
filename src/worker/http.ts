import * as Http from 'alchemy/Http'
import { Effect, Layer } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'

import { Api, CurrentUser, Health } from '../api'
import { AuthenticationLive } from './authentication'

export const SystemLive = HttpApiBuilder.group(Api, 'system', handlers =>
  handlers.handle('health', () => Effect.succeed(Health.make({ ok: true }))),
)

export const AccountLive = HttpApiBuilder.group(Api, 'account', handlers =>
  handlers.handle('me', () =>
    Effect.gen(function* () {
      return yield* CurrentUser
    }),
  ),
)

export const HttpLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide([SystemLive, AccountLive]),
  Layer.provide(AuthenticationLive),
  Layer.provide(Http.Platform),
)
