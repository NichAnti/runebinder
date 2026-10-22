import { expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { CatalogueQuery } from './domain'
import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import { AppRoute, type LoggedInRoute, type LoggedOutRoute } from './route'
import { ada } from './testing'
import { update } from './update'
import { view } from './view'

const loggedOutAt = (route: LoggedOutRoute) =>
  Model.make({
    auth: LoggedOut.init(route),
    themePreference: 'System',
    systemTheme: 'Light',
  })

const loggedInAt = (route: LoggedInRoute) =>
  Model.make({
    auth: LoggedIn.init(route, ada),
    themePreference: 'Dark',
    systemTheme: 'Light',
  })

describe('shell', () => {
  test('the footer carries the Riot notice', () => {
    scene(
      { update, view },
      given(loggedOutAt(AppRoute.SignIn())),
      expect(role('contentinfo')).toContainText('Legal Jibber Jabber'),
    )
  })

  test('signed out shows the sign-in form without the main nav', () => {
    scene(
      { update, view },
      given(loggedOutAt(AppRoute.SignIn())),
      expect(role('heading', { name: 'Sign in' })).toExist(),
      expect(role('link', { name: 'Create one' })).toHaveAttr(
        'href',
        '/sign-up',
      ),
      expect(role('navigation', { name: 'Main' })).toBeAbsent(),
    )
  })

  test('the sign-up page links back to sign in', () => {
    scene(
      { update, view },
      given(loggedOutAt(AppRoute.SignUp())),
      expect(role('heading', { name: 'Create an account' })).toExist(),
      expect(role('link', { name: 'Sign in' })).toHaveAttr('href', '/sign-in'),
    )
  })

  test('signed in loads the catalogue and shows the nav and the user', () => {
    scene(
      { update, view },
      given(loggedInAt(AppRoute.Catalogue(CatalogueQuery.empty))),
      expect(role('status')).toContainText('Loading the catalogue…'),
      expect(role('link', { name: 'Catalogue' })).toHaveAttr(
        'aria-current',
        'page',
      ),
      expect(text('Ada')).toExist(),
      expect(role('button', { name: 'Sign out' })).toExist(),
    )
  })

  test('the theme toggle shows the current preference', () => {
    scene(
      { update, view },
      given(loggedInAt(AppRoute.Catalogue(CatalogueQuery.empty))),
      expect(role('button', { name: 'Theme: Dark' })).toExist(),
    )
  })

  test('not found shows the path and a way back', () => {
    scene(
      { update, view },
      given(loggedInAt(AppRoute.NotFound({ path: '/nope' }))),
      expect(text('Nothing lives at /nope.')).toExist(),
      expect(role('link', { name: 'Go to catalogue' })).toExist(),
    )
  })
})
