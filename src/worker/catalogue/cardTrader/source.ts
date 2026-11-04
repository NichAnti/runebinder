import {
  Array,
  Config,
  Context,
  Effect,
  FileSystem,
  Layer,
  Path,
  Schema,
  String,
} from 'effect'
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/http'

import { type CatalogueSourceError, UnreadableRecording } from '../source'
import {
  type BlueprintsBySet,
  RECORDING_DIRECTORY,
  blueprintsFrom,
  expansionCodesFrom,
  readBlueprints,
  readExpansionCodes,
} from './recording'

/** What the catalogue build needs from CardTrader to link printings. */
export class CardTraderCatalogue extends Context.Service<
  CardTraderCatalogue,
  {
    readonly expansionCodes: Effect.Effect<
      Readonly<Record<string, string>>,
      CatalogueSourceError
    >
    readonly blueprintsBySet: Effect.Effect<
      BlueprintsBySet,
      CatalogueSourceError
    >
  }
>()('runebinder/worker/catalogue/CardTraderCatalogue') {}

export const RecordedCardTrader = Layer.effect(
  CardTraderCatalogue,
  Effect.gen(function* () {
    const services = Context.make(
      FileSystem.FileSystem,
      yield* FileSystem.FileSystem,
    ).pipe(Context.add(Path.Path, yield* Path.Path))

    return CardTraderCatalogue.of({
      expansionCodes: readExpansionCodes(RECORDING_DIRECTORY).pipe(
        Effect.provide(services),
      ),
      blueprintsBySet: readBlueprints(RECORDING_DIRECTORY).pipe(
        Effect.provide(services),
      ),
    })
  }),
)

const API = 'https://api.cardtrader.com/api/v2'

const RIFTBOUND_GAME_ID = 22

const RiftboundExpansion = Schema.Struct({
  id: Schema.Int,
  game_id: Schema.Int,
  code: Schema.String,
})

const unreadable = (error: unknown) =>
  new UnreadableRecording({ message: globalThis.String(error) })

// Reads CardTrader's expansions and Riftbound's blueprint exports with the
// developer's own token (CARDTRADER_TOKEN), only while building the catalogue.
export const LiveCardTrader = Layer.effect(
  CardTraderCatalogue,
  Effect.gen(function* () {
    const token = yield* Config.Redacted('CARDTRADER_TOKEN')
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(request =>
        request.pipe(
          HttpClientRequest.bearerToken(token),
          HttpClientRequest.acceptJson,
        ),
      ),
      HttpClient.filterStatusOk,
    )
    const text = (url: string, urlParams?: Record<string, string>) =>
      client.get(url, { urlParams }).pipe(
        Effect.flatMap(response => response.text),
        Effect.mapError(unreadable),
      )
    const expansionsText = yield* Effect.cached(text(`${API}/expansions`))

    return CardTraderCatalogue.of({
      expansionCodes: Effect.flatMap(expansionsText, expansionCodesFrom),
      blueprintsBySet: Effect.gen(function* () {
        const expansions = yield* Effect.flatMap(
          expansionsText,
          Schema.decodeUnknownEffect(
            Schema.fromJsonString(Schema.Array(RiftboundExpansion)),
          ),
        ).pipe(Effect.mapError(unreadable))
        const texts = yield* Effect.forEach(
          Array.filter(
            expansions,
            ({ game_id }) => game_id === RIFTBOUND_GAME_ID,
          ),
          ({ id, code }) =>
            text(`${API}/blueprints/export`, { expansion_id: `${id}` }).pipe(
              Effect.map(json => ({
                label: `blueprints of ${code}`,
                set: String.toUpperCase(code),
                json,
              })),
            ),
        )

        return yield* blueprintsFrom(texts)
      }),
    })
  }),
).pipe(Layer.provide(FetchHttpClient.layer))
