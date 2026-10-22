import * as Cloudflare from 'alchemy/Cloudflare'
import * as Drizzle from 'alchemy/Drizzle'
import { Effect } from 'effect'

export const AppDb = Effect.gen(function* () {
  const schema = yield* Drizzle.Schema('AppSchema', {
    schema: './src/worker/schema/index.ts',
    out: './migrations',
    dialect: 'sqlite',
  })

  return yield* Cloudflare.D1.Database('AppDb', { migrations: schema })
})
