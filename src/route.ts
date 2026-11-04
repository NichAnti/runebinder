import { Option, Schema, SchemaTransformation, pipe } from 'effect'
import { Route } from 'foldkit'
import { defineRouteUnion, literal, schemaSegment, slash } from 'foldkit/route'

import { CatalogueQuery, Deck, Printing, Wishlist } from './domain'

export const AppRoute = defineRouteUnion({
  Home: {},
  SignIn: {},
  SignUp: {},
  Catalogue: CatalogueQuery.Query.fields,
  Card: {
    cardId: Printing.CardId,
    printing: Schema.Option(Printing.PrintingId),
  },
  CardTrader: {},
  Decks: {},
  Deck: { deckId: Deck.DeckId },
  Wishlists: {},
  CustomWishlist: {},
  DeckWishlist: { deckId: Deck.DeckId },
  CardTraderWishlist: { wishlistId: Wishlist.CardTraderWishlistId },
  NotFound: { path: Schema.String },
})
export type AppRoute = typeof AppRoute.Type
export type CatalogueRoute = typeof AppRoute.Catalogue.Type
export type CardRoute = typeof AppRoute.Card.Type
export type DeckRoute = typeof AppRoute.Deck.Type

export const LoggedOutRoute = AppRoute.subset([
  'Home',
  'SignIn',
  'SignUp',
  'NotFound',
])
export type LoggedOutRoute = typeof LoggedOutRoute.Type

export const LoggedInRoute = AppRoute.subset([
  'Catalogue',
  'Card',
  'CardTrader',
  'Decks',
  'Deck',
  'Wishlists',
  'CustomWishlist',
  'DeckWishlist',
  'CardTraderWishlist',
  'NotFound',
])
export type LoggedInRoute = typeof LoggedInRoute.Type

const validParam = <A extends string>(schema: Schema.Codec<A, string>) => {
  const decode = Schema.decodeUnknownOption(schema)

  return Schema.OptionFromOptional(Schema.String).pipe(
    Schema.decodeTo(
      Schema.Option(schema),
      SchemaTransformation.transform({
        decode: (maybeRaw: Option.Option<string>): Option.Option<string> =>
          Option.filter(maybeRaw, raw => Option.isSome(decode(raw))),
        encode: (maybeValue: Option.Option<string>): Option.Option<string> =>
          maybeValue,
      }),
    ),
  )
}

export const homeRouter = pipe(Route.root, Route.mapTo(AppRoute.Home))
export const signInRouter = pipe(
  literal('sign-in'),
  Route.mapTo(AppRoute.SignIn),
)
export const signUpRouter = pipe(
  literal('sign-up'),
  Route.mapTo(AppRoute.SignUp),
)
export const cardTraderRouter = pipe(
  literal('cardtrader'),
  Route.mapTo(AppRoute.CardTrader),
)
export const wishlistsRouter = pipe(
  literal('wishlists'),
  Route.mapTo(AppRoute.Wishlists),
)
export const customWishlistRouter = pipe(
  literal('wishlists'),
  slash(literal('custom')),
  Route.mapTo(AppRoute.CustomWishlist),
)
export const deckWishlistRouter = pipe(
  literal('wishlists'),
  slash(schemaSegment('deckId', Deck.DeckId)),
  Route.mapTo(AppRoute.DeckWishlist),
)
export const cardTraderWishlistRouter = pipe(
  literal('cardtrader'),
  slash(literal('wishlists')),
  slash(
    schemaSegment(
      'wishlistId',
      Schema.FiniteFromString.pipe(
        Schema.decodeTo(Wishlist.CardTraderWishlistId),
      ),
    ),
  ),
  Route.mapTo(AppRoute.CardTraderWishlist),
)

export const wishlistHref = (ref: Wishlist.WishlistRef): string =>
  ref._tag === 'Custom'
    ? customWishlistRouter()
    : deckWishlistRouter({ deckId: ref.deckId })
export const decksRouter = pipe(literal('decks'), Route.mapTo(AppRoute.Decks))
export const deckRouter = pipe(
  literal('decks'),
  slash(schemaSegment('deckId', Deck.DeckId)),
  Route.mapTo(AppRoute.Deck),
)
export const catalogueRouter = pipe(
  literal('cards'),
  Route.query(CatalogueQuery.QueryParams),
  Route.mapTo(AppRoute.Catalogue),
)
export const cardRouter = pipe(
  literal('cards'),
  slash(schemaSegment('cardId', Printing.CardId)),
  Route.query(Schema.Struct({ printing: validParam(Printing.PrintingId) })),
  Route.mapTo(AppRoute.Card),
)

export const catalogueHome = (): string => catalogueRouter(CatalogueQuery.empty)

const routeParser = Route.oneOf(
  signInRouter,
  signUpRouter,
  cardRouter,
  cardTraderWishlistRouter,
  cardTraderRouter,
  deckRouter,
  decksRouter,
  customWishlistRouter,
  deckWishlistRouter,
  wishlistsRouter,
  catalogueRouter,
  homeRouter,
)

export const urlToAppRoute = Route.parseUrlWithFallback(
  routeParser,
  AppRoute.NotFound,
)
