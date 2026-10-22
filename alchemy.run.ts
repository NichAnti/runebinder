import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'

import Backend from './src/worker/backend'

export class Website extends Cloudflare.Website.Foldkit<Website>()('Website', {
  main: 'src/worker/gateway.ts',
  assets: {
    runWorkerFirst: ['/api', '/api/*'],
  },
  env: { API: Backend },
}) {}

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>

export default Alchemy.Stack(
  'Cardtrader',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* Website

    return {
      url: worker.url,
    }
  }),
)
