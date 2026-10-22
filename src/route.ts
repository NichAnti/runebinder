import { Schema, pipe } from 'effect'
import { Route } from 'foldkit'
import { defineRouteUnion, literal } from 'foldkit/route'

export const AppRoute = defineRouteUnion({
  SignIn: {},
  SignUp: {},
  Catalogue: {},
  NotFound: { path: Schema.String },
})
export type AppRoute = typeof AppRoute.Type

export const LoggedOutRoute = AppRoute.subset(['SignIn', 'SignUp', 'NotFound'])
export type LoggedOutRoute = typeof LoggedOutRoute.Type

export const LoggedInRoute = AppRoute.subset(['Catalogue', 'NotFound'])
export type LoggedInRoute = typeof LoggedInRoute.Type

export const signInRouter = pipe(
  literal('sign-in'),
  Route.mapTo(AppRoute.SignIn),
)
export const signUpRouter = pipe(
  literal('sign-up'),
  Route.mapTo(AppRoute.SignUp),
)
export const catalogueRouter = pipe(Route.root, Route.mapTo(AppRoute.Catalogue))

const routeParser = Route.oneOf(signInRouter, signUpRouter, catalogueRouter)

export const urlToAppRoute = Route.parseUrlWithFallback(
  routeParser,
  AppRoute.NotFound,
)
