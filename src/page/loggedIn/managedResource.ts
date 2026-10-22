import { Effect, Option, Schema } from 'effect'
import { ManagedResource } from 'foldkit'

import { CatalogueIndexResource, loadCatalogueIndex } from '../../service'
import { Message } from './message'
import { CatalogueState, type Model } from './model'

export const managedResources = ManagedResource.make<Model, Message>()(
  entry => ({
    catalogueIndex: entry(Schema.Option(Schema.Int), {
      resource: CatalogueIndexResource,
      modelToMaybeRequirements: model =>
        CatalogueState.match(model.catalogue, {
          Loading: ({ attempt }) => Option.some(attempt),
          Ready: ({ attempt }) => Option.some(attempt),
          Failed: () => Option.none(),
        }),
      acquire: () => loadCatalogueIndex,
      release: () => Effect.void,
      onAcquired: index =>
        Message.AcquiredCatalogueIndex({ allValues: index.allValues }),
      onReleased: () => Message.ReleasedCatalogueIndex(),
      onAcquireError: error =>
        Message.FailedAcquireCatalogueIndex({ reason: String(error) }),
    }),
  }),
)
