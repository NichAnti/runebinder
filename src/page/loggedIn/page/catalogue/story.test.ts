import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { CatalogueQuery } from '../../../../domain'
import { searchResult } from '../../../../testing'
import { Message } from './message'
import { PAGE_SIZE, Results, init } from './model'
import { ReplaceQuery, SearchCatalogue, enter, update } from './update'

const query = CatalogueQuery.empty
const searching = modifyFields(init(query), {})

describe('changes go through the URL', () => {
  test('typing replaces the URL with the trimmed search', () => {
    story(
      update(query),
      given(searching),
      message(Message.UpdatedSearch({ value: 'vi ' })),
      model(next => {
        expect(next.searchText).toBe('vi ')
      }),
      Command.expectHas(
        ReplaceQuery({ query: { ...query, q: Option.some('vi') } }),
      ),
      Command.resolve(ReplaceQuery, Message.CompletedReplaceQuery()),
    )
  })

  test('toggling a filter replaces the URL with that filter', () => {
    story(
      update(query),
      given(searching),
      message(Message.ToggledFilter({ facet: 'domain', value: 'Fury' })),
      Command.expectHas(
        ReplaceQuery({ query: { ...query, domain: ['Fury'] } }),
      ),
      Command.resolve(ReplaceQuery, Message.CompletedReplaceQuery()),
    )
  })
})

describe('searching', () => {
  test('entering the page searches once the index is ready', () => {
    const entered = enter(init(query), query, true)
    expect(entered.commands?.length).toBe(1)
  })

  test('entering before the index is ready waits', () => {
    expect(enter(init(query), query, false).commands).toBeUndefined()
  })

  test('a result for an older query is ignored', () => {
    story(
      update({ ...query, q: Option.some('vi') }),
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
      update(query),
      given(searching),
      message(Message.ClickedShowMore()),
      model(next => {
        expect(next.limit).toBe(PAGE_SIZE * 2)
      }),
      Command.expectHas(SearchCatalogue({ query, limit: PAGE_SIZE * 2 })),
      Command.resolve(SearchCatalogue, Message.SkippedSearchCatalogue()),
    )
  })
})
