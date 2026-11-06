import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { Wishlist } from '../../../domain'
import { Message } from './message'
import { Deletion, Detail, Listing, init } from './model'
import {
  DeleteWishlist,
  ListWishlists,
  ShowWishlist,
  added,
  deletionOf,
  detailOf,
  ensureListed,
  ensureShown,
  remove,
  removed,
  update,
} from './update'

const first = Wishlist.CardTraderWishlistId.make(3572164)
const second = Wishlist.CardTraderWishlistId.make(3572170)
const listed = {
  ...init(),
  listing: Listing.Ready({
    wishlists: [
      { id: first, name: 'Vi aggro (Runebinder)' },
      { id: second, name: 'Bought at the fair' },
    ],
  }),
}

describe('CardTrader wishlists', () => {
  test('the list is read once per visit', () => {
    const listing = ensureListed(init())

    expect(listing.commands?.map(({ name }) => name)).toStrictEqual([
      ListWishlists.name,
    ])
    expect(ensureListed(listing.model).commands).toBeUndefined()
  })

  test('a wishlist is read once, and again after a failure', () => {
    const showing = ensureShown(init(), first)

    expect(showing.commands?.map(({ name }) => name)).toStrictEqual([
      ShowWishlist.name,
    ])
    expect(ensureShown(showing.model, first).commands).toBeUndefined()
    story(
      update,
      given(showing.model),
      message(
        Message.FailedShowWishlist({
          wishlistId: first,
          reason: 'Unavailable',
        }),
      ),
      model(next => {
        expect(detailOf(next, first)).toStrictEqual(
          Option.some(Detail.Failed({ reason: 'Unavailable' })),
        )
        expect(
          ensureShown(next, first).commands?.map(({ name }) => name),
        ).toStrictEqual([ShowWishlist.name])
      }),
    )
  })

  test('deleting removes it from the list', () => {
    const deleting = remove(listed, second)

    expect(deleting.commands?.map(({ name }) => name)).toStrictEqual([
      DeleteWishlist.name,
    ])
    expect(deletionOf(deleting.model, second)).toStrictEqual(
      Option.some(Deletion.Deleting()),
    )
    story(
      update,
      given(deleting.model),
      message(Message.SucceededDeleteWishlist({ wishlistId: second })),
      model(next => {
        expect(next.listing).toStrictEqual(
          Listing.Ready({
            wishlists: [{ id: first, name: 'Vi aggro (Runebinder)' }],
          }),
        )
        expect(deletionOf(next, second)).toStrictEqual(Option.none())
      }),
    )
  })

  test('a failed deletion is kept and nothing more is sent', () => {
    story(
      update,
      given(listed),
      message(
        Message.FailedDeleteWishlist({
          wishlistId: second,
          reason: 'RateLimited',
        }),
      ),
      Command.expectNone(),
      model(next => {
        expect(deletionOf(next, second)).toStrictEqual(
          Option.some(Deletion.Failed({ reason: 'RateLimited' })),
        )
      }),
    )
  })

  test('changes made from this app update the list without reading it again', () => {
    const third = Wishlist.CardTraderWishlistId.make(3572180)
    const next = removed(added(listed, { id: third, name: 'New' }), first)

    expect(next.listing).toStrictEqual(
      Listing.Ready({
        wishlists: [
          { id: second, name: 'Bought at the fair' },
          { id: third, name: 'New' },
        ],
      }),
    )
  })
})
