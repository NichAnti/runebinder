import { Effect, Option, Record, Schema } from 'effect'
import { Command, Update } from 'foldkit'
import { replaceUrl } from 'foldkit/navigation'
import { modifyFields } from 'foldkit/struct'

import {
  CatalogueQuery,
  CatalogueSearch,
  Collection,
  Printing,
} from '../../../../domain'
import { catalogueRouter } from '../../../../route'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
} from '../../../../service'
import * as CardPanel from '../../cardPanel'
import { Message, OutMessage } from './message'
import { type Model, PAGE_SIZE, Results } from './model'

type UpdateReturn = Update.Return<Model, Message, CatalogueIndexService>

// COMMAND

export const ReplaceQuery = Command.define('ReplaceQuery', {
  args: { query: CatalogueQuery.Query },
  messages: [Message.CompletedReplaceQuery],
  execute: ({ query }) =>
    replaceUrl(catalogueRouter(query)).pipe(
      Effect.as(Message.CompletedReplaceQuery()),
    ),
})

export const SearchCatalogue = Command.define('SearchCatalogue', {
  args: {
    query: CatalogueQuery.Query,
    limit: Schema.Int,
    ownedPrintingIds: Schema.Array(Printing.PrintingId),
  },
  messages: [Message.SucceededSearchCatalogue, Message.SkippedSearchCatalogue],
  execute: ({ query, limit, ownedPrintingIds }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const result = yield* CatalogueIndex.searchCards(
        index,
        query,
        limit,
        ownedPrintingIds,
      )
      return Message.SucceededSearchCatalogue({ query, limit, result })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedSearchCatalogue()),
      ),
    ),
})

// ROUTE

const search = (
  query: CatalogueQuery.Query,
  limit: number,
  maybeOwned: Option.Option<Collection.Owned>,
) =>
  query.ownership === 'All'
    ? Option.some(SearchCatalogue({ query, limit, ownedPrintingIds: [] }))
    : Option.map(maybeOwned, owned =>
        SearchCatalogue({ query, limit, ownedPrintingIds: Record.keys(owned) }),
      )

export const enter = (
  model: Model,
  query: CatalogueQuery.Query,
  isIndexReady: boolean,
  maybeOwned: Option.Option<Collection.Owned>,
): UpdateReturn => {
  const typedTerm = CatalogueQuery.withTerm(
    CatalogueQuery.empty,
    model.searchText,
  ).q
  const urlTerm = Option.getOrElse(query.q, () => '')
  const nextModel = modifyFields(model, {
    limit: () => PAGE_SIZE,
    searchText: searchText =>
      Option.getOrElse(typedTerm, () => '') === urlTerm ? searchText : urlTerm,
  })

  return isIndexReady
    ? {
        model: nextModel,
        commands: Option.toArray(search(query, PAGE_SIZE, maybeOwned)),
      }
    : { model: nextModel }
}

// UPDATE

const replace = (model: Model, query: CatalogueQuery.Query): UpdateReturn => ({
  model,
  commands: [ReplaceQuery({ query })],
})

const foldCardPanel = Update.foldChild({
  update: CardPanel.update,
  read: (model: Model) => Option.some(model.cardPanel),
  write: (model: Model, nextCardPanel: CardPanel.Model): Model =>
    modifyFields(model, { cardPanel: () => nextCardPanel }),
  toParentMessage: message => Message.GotCardPanelMessage({ message }),
  toParentOutMessage: CardPanel.OutMessage.match<OutMessage>({
    SteppedQuantity: stepped => OutMessage.SteppedQuantity(stepped),
    RequestedCollectionRetry: () => OutMessage.RequestedCollectionRetry(),
  }),
})

export const update =
  (query: CatalogueQuery.Query, maybeOwned: Option.Option<Collection.Owned>) =>
  (model: Model, message: Message) =>
    Message.match<
      Update.ReturnWithOutMessage<
        Model,
        Message,
        OutMessage,
        CatalogueIndexService
      >
    >(message, {
      UpdatedSearch: ({ value }) =>
        replace(
          modifyFields(model, { searchText: () => value }),
          CatalogueQuery.withTerm(query, value),
        ),

      ToggledFilter: ({ facet, value }) =>
        replace(model, CatalogueQuery.toggleFacet(query, facet, value)),

      ChangedRange: ({ field, bound, value }) =>
        replace(model, CatalogueQuery.withBound(query, field, bound, value)),

      SelectedSort: ({ value }) =>
        replace(model, { ...query, sort: CatalogueQuery.parseSort(value) }),

      SelectedOwnership: ({ value }) =>
        replace(model, {
          ...query,
          ownership: CatalogueQuery.parseOwnership(value),
        }),

      ClickedClearFilters: () =>
        replace(model, CatalogueQuery.clearFilters(query)),

      ClickedShowMore: () => {
        const nextLimit = model.limit + PAGE_SIZE

        return {
          model: modifyFields(model, { limit: () => nextLimit }),
          commands: Option.toArray(search(query, nextLimit, maybeOwned)),
        }
      },

      ToggledFiltersPanel: ({ isOpen }) => ({
        model: modifyFields(model, { isFiltersOpen: () => isOpen }),
      }),

      ClickedShowAllTags: () => ({
        model: modifyFields(model, { isShowingAllTags: () => true }),
      }),

      CompletedReplaceQuery: () => ({ model }),

      SucceededSearchCatalogue: ({ query: resultQuery, limit, result }) =>
        CatalogueQuery.isSameQuery(resultQuery, query) && limit === model.limit
          ? {
              model: modifyFields(model, {
                results: () =>
                  Results.Showing({ query: resultQuery, limit, result }),
              }),
            }
          : { model },

      SkippedSearchCatalogue: () => ({ model }),

      GotCardPanelMessage: ({ message }) => foldCardPanel(model, message),
    })

export const currentResult = (
  model: Model,
): Option.Option<CatalogueSearch.SearchResult> =>
  Results.match(model.results, {
    Waiting: () => Option.none(),
    Showing: ({ result }) => Option.some(result),
  })
