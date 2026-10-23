import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { CatalogueQuery, Collection, Printing } from '../../../../domain'
import { searchResult } from '../../../../testing'
import { Message } from './message'
import { PAGE_SIZE, Results, init } from './model'
import {
  type Context,
  ReplaceQuery,
  SearchCatalogue,
  enter,
  update,
} from './update'

const query = CatalogueQuery.empty

const inCatalogue = (
  query: CatalogueQuery.Query,
  maybeOwned: Option.Option<Collection.Owned> = Option.none(),
): Context => ({ scope: 'Catalogue', query, maybeOwned })
const vi = Printing.PrintingId.make('ogn-066-298')
const searching = modifyFields(init(query), {})

describe('changes go through the URL', () => {
  test('typing replaces the URL with the trimmed search', () => {
    story(
      update(inCatalogue(query)),
      given(searching),
      message(Message.UpdatedSearch({ value: 'vi ' })),
      model(next => {
        expect(next.searchText).toBe('vi ')
      }),
      Command.expectHas(
        ReplaceQuery({
          scope: 'Catalogue',
          query: { ...query, q: Option.some('vi') },
        }),
      ),
      Command.resolve(ReplaceQuery, Message.CompletedReplaceQuery()),
    )
  })

  test('toggling a filter replaces the URL with that filter', () => {
    story(
      update(inCatalogue(query)),
      given(searching),
      message(Message.ToggledFilter({ facet: 'domain', value: 'Fury' })),
      Command.expectHas(
        ReplaceQuery({
          scope: 'Catalogue',
          query: { ...query, domain: ['Fury'] },
        }),
      ),
      Command.resolve(ReplaceQuery, Message.CompletedReplaceQuery()),
    )
  })
})

describe('searching', () => {
  test('the ownership filter waits for the collection, then sends it', () => {
    const ownedQuery: CatalogueQuery.Query = { ...query, ownership: 'Owned' }
    const owned = { [vi]: Collection.OwnedQuantity.make(1) }
    const waiting = enter(
      init(ownedQuery),
      inCatalogue(ownedQuery, Option.none()),
      true,
    )
    const searching = enter(
      init(ownedQuery),
      inCatalogue(ownedQuery, Option.some(owned)),
      true,
    )

    expect(waiting.commands).toStrictEqual([])
    expect(
      searching.commands?.map(({ name, args }) => ({ name, args })),
    ).toStrictEqual([
      {
        name: SearchCatalogue.name,
        args: { query: ownedQuery, limit: PAGE_SIZE, ownedPrintingIds: [vi] },
      },
    ])
  })

  test('choosing what to show replaces the URL', () => {
    story(
      update(inCatalogue(query)),
      given(searching),
      message(Message.SelectedOwnership({ value: 'NotOwned' })),
      Command.expectHas(
        ReplaceQuery({
          scope: 'Catalogue',
          query: { ...query, ownership: 'NotOwned' },
        }),
      ),
      Command.resolve(ReplaceQuery, Message.CompletedReplaceQuery()),
    )
  })

  test('entering the page searches once the index is ready', () => {
    const entered = enter(init(query), inCatalogue(query, Option.none()), true)
    expect(entered.commands?.length).toBe(1)
  })

  test('entering before the index is ready waits', () => {
    expect(
      enter(init(query), inCatalogue(query, Option.none()), false).commands,
    ).toBeUndefined()
  })

  test('a result for an older query is ignored', () => {
    story(
      update(inCatalogue({ ...query, q: Option.some('vi') })),
      given(searching),
      message(
        Message.SucceededSearchCatalogue({
          query,
          limit: PAGE_SIZE,
          result: searchResult,
        }),
      ),
      model(next => {
        expect(next.results).toStrictEqual(Results.Waiting())
      }),
    )
  })

  test('show more asks for the next page', () => {
    story(
      update(inCatalogue(query)),
      given(searching),
      message(Message.ClickedShowMore()),
      model(next => {
        expect(next.limit).toBe(PAGE_SIZE * 2)
      }),
      Command.expectHas(
        SearchCatalogue({
          query,
          limit: PAGE_SIZE * 2,
          ownedPrintingIds: [],
        }),
      ),
      Command.resolve(SearchCatalogue, Message.SkippedSearchCatalogue()),
    )
  })
})
