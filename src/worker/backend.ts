import * as Cloudflare from 'alchemy/Cloudflare'
import { Effect } from 'effect'
import { HttpRouter } from 'effect/http'

import { HttpLive } from './http'

export default class Backend extends Cloudflare.Worker<Backend>()(
  'Backend',
  { main: import.meta.url, workersDev: false },
  Effect.gen(function* () {
    const http = yield* HttpRouter.toHttpEffect(HttpLive)
    return { fetch: http }
  }),
) {}
