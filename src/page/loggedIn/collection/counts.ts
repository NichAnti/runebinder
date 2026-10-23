import { Collection } from '../../../domain'
import { Counts } from '../printings/counts'
import { Model } from './model'

export const countsOf = (collection: Model): Counts =>
  Model.match(collection, {
    NotLoaded: () => Counts.Loading(),
    Loading: () => Counts.Loading(),
    Failed: () => Counts.Failed(),
    Ready: ({ owned }) =>
      Counts.Ready({
        kind: 'Owned',
        quantities: owned,
        max: Collection.MAX_QUANTITY,
      }),
  })
