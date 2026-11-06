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
    // Alchemy runs the seed once per stage and catalogue version (again only
    // if a run failed); the seed fetches and uploads only if the shared bucket
    // lacks that version, so the catalogue is fetched and uploaded once.
    const catalogue = yield* CatalogueSeed({ version: CATALOGUE_VERSION })
    const worker = yield* Website

    return {
      url: worker.url,
      catalogue,
    }
  }),
)
