import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'

// The private bucket that holds the packed card data (never committed). It is
// shared by every stage of the app, so it lives in its own stack, deployed
// once with `bun run data:deploy`, and is kept even if the stack is destroyed.
export const CARD_DATA_BUCKET = 'cardtrader-data'

export default Alchemy.Stack(
  'CardtraderData',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const bucket = yield* Cloudflare.R2.Bucket('CardData', {
      name: CARD_DATA_BUCKET,
    }).pipe(Alchemy.RemovalPolicy.retain())

    return { bucket: bucket.bucketName }
  }),
)
