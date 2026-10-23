import { Effect, Option, Schema } from 'effect'
import { Command, Update } from 'foldkit'
import { replaceUrl } from 'foldkit/navigation'
import { modifyFields } from 'foldkit/struct'

import { CatalogueQuery, CatalogueSearch } from '../../../../domain'
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
  args: { query: CatalogueQuery.Query, limit: Schema.Int },
  messages: [Message.SucceededSearchCatalogue, Message.SkippedSearchCatalogue],
  execute: ({ query, limit }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const result = yield* CatalogueIndex.searchCards(index, query, limit)
      return Message.SucceededSearchCatalogue({ query, limit, result })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedSearchCatalogue()),
      ),
    ),
})

// ROUTE

export const enter = (
  model: Model,
  query: CatalogueQuery.Query,
  isIndexReady: boolean,
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
        commands: [SearchCatalogue({ query, limit: PAGE_SIZE })],
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
  (query: CatalogueQuery.Query) => (model: Model, message: Message) =>
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

      ClickedClearFilters: () =>
        replace(model, CatalogueQuery.clearFilters(query)),

      ClickedShowMore: () => {
        const nextLimit = model.limit + PAGE_SIZE

        return {
          model: modifyFields(model, { limit: () => nextLimit }),
          commands: [SearchCatalogue({ query, limit: nextLimit })],
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
