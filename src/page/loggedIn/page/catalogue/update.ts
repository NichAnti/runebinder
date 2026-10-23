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
import { catalogueRouter, collectionRouter } from '../../../../route'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
} from '../../../../service'
import * as CardPanel from '../../cardPanel'
import { Message, OutMessage } from './message'
import { type Model, PAGE_SIZE, Results, Scope } from './model'

type UpdateReturn = Update.Return<Model, Message, CatalogueIndexService>

export type Context = Readonly<{
  scope: Scope
  query: CatalogueQuery.Query
  maybeOwned: Option.Option<Collection.Owned>
}>

const searchQueryOf = ({ scope, query }: Context): CatalogueQuery.Query =>
  scope === 'Collection' ? { ...query, ownership: 'Owned' } : query

// COMMAND

export const ReplaceQuery = Command.define('ReplaceQuery', {
  args: { scope: Scope, query: CatalogueQuery.Query },
  messages: [Message.CompletedReplaceQuery],
  execute: ({ scope, query }) =>
    replaceUrl(
      scope === 'Collection' ? collectionRouter(query) : catalogueRouter(query),
    ).pipe(Effect.as(Message.CompletedReplaceQuery())),
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

const search = (context: Context, limit: number) => {
  const query = searchQueryOf(context)

  return query.ownership === 'All'
    ? Option.some(SearchCatalogue({ query, limit, ownedPrintingIds: [] }))
    : Option.map(context.maybeOwned, owned =>
        SearchCatalogue({ query, limit, ownedPrintingIds: Record.keys(owned) }),
      )
}

export const enter = (
  model: Model,
  context: Context,
  isIndexReady: boolean,
): UpdateReturn => {
  const { query } = context
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
        commands: Option.toArray(search(context, PAGE_SIZE)),
      }
    : { model: nextModel }
}

// UPDATE

const replace =
  (scope: Scope) =>
  (model: Model, query: CatalogueQuery.Query): UpdateReturn => ({
    model,
    commands: [ReplaceQuery({ scope, query })],
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

export const update = (context: Context) => {
  const { query } = context
  const replaceWith = replace(context.scope)

  return (model: Model, message: Message) =>
    Message.match<
      Update.ReturnWithOutMessage<
        Model,
        Message,
        OutMessage,
        CatalogueIndexService
      >
    >(message, {
      UpdatedSearch: ({ value }) =>
        replaceWith(
          modifyFields(model, { searchText: () => value }),
          CatalogueQuery.withTerm(query, value),
        ),

      ToggledFilter: ({ facet, value }) =>
        replaceWith(model, CatalogueQuery.toggleFacet(query, facet, value)),

      ChangedRange: ({ field, bound, value }) =>
        replaceWith(
          model,
          CatalogueQuery.withBound(query, field, bound, value),
        ),

      SelectedSort: ({ value }) =>
        replaceWith(model, { ...query, sort: CatalogueQuery.parseSort(value) }),

      SelectedOwnership: ({ value }) =>
        replaceWith(model, {
          ...query,
          ownership: CatalogueQuery.parseOwnership(value),
        }),

      ClickedClearFilters: () =>
        replaceWith(model, CatalogueQuery.clearFilters(query)),

      ClickedShowMore: () => {
        const nextLimit = model.limit + PAGE_SIZE

        return {
          model: modifyFields(model, { limit: () => nextLimit }),
          commands: Option.toArray(search(context, nextLimit)),
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
        CatalogueQuery.isSameQuery(resultQuery, searchQueryOf(context)) &&
        limit === model.limit
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
}

export const currentResult = (
  model: Model,
): Option.Option<CatalogueSearch.SearchResult> =>
  Results.match(model.results, {
    Waiting: () => Option.none(),
    Showing: ({ result }) => Option.some(result),
  })
