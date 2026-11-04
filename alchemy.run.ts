import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Drizzle from 'alchemy/Drizzle'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import { CATALOGUE_VERSION } from './src/api'
import Backend from './src/worker/backend'
import { CatalogueSeed } from './src/worker/catalogue/seed'

export class Website extends Cloudflare.Website.Foldkit<Website>()('Website', {
  main: 'src/worker/gateway.ts',
  assets: {
    runWorkerFirst: ['/api', '/api/*'],
  },
  env: { API: Backend },
}) {}

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>

export default Alchemy.Stack(
  'Runebinder',
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Drizzle.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    // An Action only runs when its input changes, but the seed must look at
    // the bucket on every deploy and dev run (it may have been emptied, or
    // this may be the first run against it). `checkedAt` makes it run each
    // time; the seed itself uploads only when the catalogue is missing.
    const catalogue = yield* CatalogueSeed({
      version: CATALOGUE_VERSION,
      checkedAt: new Date().toISOString(),
    })
    const worker = yield* Website

    return {
      url: worker.url,
      catalogue,
    }
  }),
)
