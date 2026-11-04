import { Effect, Schema } from 'effect'
import { FetchHttpClient, HttpClient } from 'effect/http'
import { ManagedResource } from 'foldkit'

import catalogueUrl from '../../catalogue/catalogue.json?url'
import { Catalogue } from '../domain'
import * as CatalogueIndex from './catalogueIndex'

export const CatalogueIndexResource =
  ManagedResource.tag<CatalogueIndex.CatalogueIndex>()('CatalogueIndex')
export type CatalogueIndexService = ManagedResource.ServiceOf<
  typeof CatalogueIndexResource
>

const decodeCatalogue = Schema.decodeEffect(Catalogue.CatalogueJson)

export const loadPrintings = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
  const url = yield* Effect.sync(
    () => new URL(catalogueUrl, window.location.origin),
  )
  const response = yield* client.get(url)
  const catalogue = yield* response.text.pipe(Effect.flatMap(decodeCatalogue))

  return catalogue.printings
}).pipe(Effect.provide(FetchHttpClient.layer))

export const loadCatalogueIndex = loadPrintings.pipe(
  Effect.flatMap(CatalogueIndex.build),
)
