import { Option, Schema, SchemaTransformation, pipe } from 'effect'
import { Route } from 'foldkit'
import { defineRouteUnion, literal, schemaSegment, slash } from 'foldkit/route'

import { CatalogueQuery, Printing } from './domain'

export const AppRoute = defineRouteUnion({
  SignIn: {},
  SignUp: {},
  Catalogue: CatalogueQuery.Query.fields,
  Card: {
    cardId: Printing.CardId,
    printing: Schema.Option(Printing.PrintingId),
  },
  CardTrader: {},
  NotFound: { path: Schema.String },
})
export type AppRoute = typeof AppRoute.Type
export type CatalogueRoute = typeof AppRoute.Catalogue.Type
export type CardRoute = typeof AppRoute.Card.Type

export const LoggedOutRoute = AppRoute.subset(['SignIn', 'SignUp', 'NotFound'])
export type LoggedOutRoute = typeof LoggedOutRoute.Type

export const LoggedInRoute = AppRoute.subset([
  'Catalogue',
  'Card',
  'CardTrader',
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
export const catalogueRouter = pipe(
  Route.root,
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
  cardTraderRouter,
  catalogueRouter,
)

export const urlToAppRoute = Route.parseUrlWithFallback(
  routeParser,
  AppRoute.NotFound,
)
