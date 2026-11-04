import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Drizzle from 'alchemy/Drizzle'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

import Backend from './src/worker/backend'

export class Website extends Cloudflare.Website.Foldkit<Website>()('Website', {
  main: 'src/worker/gateway.ts',
  assets: {
    runWorkerFirst: ['/api', '/api/*'],
  },
  env: { API: Backend },
}) {}

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>

// The private bucket that holds the packed card data, which is never committed
// (see README, "Card data"). Every stage declares the same bucket: the first
// deploy creates it, later ones find it, and destroying a stage keeps it.
const CARD_DATA_BUCKET = 'cardtrader-data'

export default Alchemy.Stack(
  'Cardtrader',
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Drizzle.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* Website
    const cardData = yield* Cloudflare.R2.Bucket('CardData', {
      name: CARD_DATA_BUCKET,
    }).pipe(Alchemy.RemovalPolicy.retain())

    return {
      url: worker.url,
      cardData: cardData.bucketName,
    }
  }),
)
