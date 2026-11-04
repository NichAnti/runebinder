import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import { Console, Effect, Layer, Schema } from 'effect'

import { catalogueKey, printingTypesKey } from '../../api'
import { Catalogue } from '../../domain'
import { CardDataBucket } from '../cardData'
import { buildCatalogue } from './build'
import { LiveCardTrader } from './cardTrader/source'
import { LiveRiotGallery } from './riotGallery/live'

const LiveSources = Layer.mergeAll(LiveRiotGallery, LiveCardTrader)

const encodeCatalogue = Schema.encodeEffect(Catalogue.CatalogueJson)
const encodePrintingTypes = Schema.encodeEffect(Catalogue.PrintingTypesJson)

// Seeds the card data bucket during a deploy, like a database seed: if this
// catalogue version is already there it does nothing, otherwise it builds the
// catalogue from the sources and uploads it. It runs on the machine or CI job
// that deploys (not in a Worker), so building it is not limited by Worker CPU.
export const CatalogueSeed = Alchemy.Action(
  'CatalogueSeed',
  Effect.gen(function* () {
    const bucket = yield* Cloudflare.R2.ReadWriteBucket(yield* CardDataBucket)

    return Effect.fn(function* ({ version }: { version: string }) {
      const existing = yield* bucket.head(catalogueKey(version))

      if (existing !== null) {
        return { version, seeded: false }
      }

      const { catalogue, printingsNotOnCardTrader } =
        yield* buildCatalogue.pipe(Effect.provide(LiveSources))
      // The catalogue goes last: its presence means the version is complete.
      yield* bucket.put(
        printingTypesKey(version),
        yield* encodePrintingTypes(Catalogue.printingTypesOf(catalogue)),
      )
      yield* bucket.put(
        catalogueKey(version),
        yield* encodeCatalogue(catalogue),
      )
      yield* Console.log(
        `Seeded catalogue ${version}: ${catalogue.printings.length} printings, ${printingsNotOnCardTrader.length} not on CardTrader`,
      )

      return { version, seeded: true }
    })
  }).pipe(Effect.provide(Cloudflare.R2.ReadWriteBucketLocal)),
)
