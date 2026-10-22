import * as Http from 'alchemy/Http'
import { Effect, Layer } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'

import { Api, Health } from '../api'

export const SystemLive = HttpApiBuilder.group(Api, 'system', handlers =>
  handlers.handle('health', () => Effect.succeed(Health.make({ ok: true }))),
)

export const HttpLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(SystemLive),
  Layer.provide(Http.Platform),
)
