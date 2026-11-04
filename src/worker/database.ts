import * as Cloudflare from 'alchemy/Cloudflare'
import * as Drizzle from 'alchemy/Drizzle'
import { Context, Effect, Layer } from 'effect'

export const AppDb = Effect.gen(function* () {
  const schema = yield* Drizzle.Schema('AppSchema', {
    schema: './src/worker/schema/index.ts',
    out: './migrations',
    dialect: 'sqlite',
  })

  return yield* Cloudflare.D1.Database('AppDb', { migrations: schema })
})

/** @effect-expect-leaking RuntimeContext */
export class AppDatabase extends Context.Service<
  AppDatabase,
  Cloudflare.D1.QueryDatabaseClient
>()('runebinder/worker/AppDatabase') {
  static readonly layer = Layer.effect(
    AppDatabase,
    Cloudflare.D1.QueryDatabase(AppDb),
  ).pipe(Layer.provide(Cloudflare.D1.QueryDatabaseBinding))
}
