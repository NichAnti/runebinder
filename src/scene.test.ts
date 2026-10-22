import { expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import { AppRoute, type LoggedInRoute } from './route'
import { update } from './update'
import { view } from './view'

const loggedOut = Model.make({
  auth: LoggedOut.init(AppRoute.SignIn()),
  themePreference: 'System',
  systemTheme: 'Light',
})

const loggedInAt = (route: LoggedInRoute) =>
  Model.make({
    auth: LoggedIn.init(route),
    themePreference: 'Dark',
    systemTheme: 'Light',
  })

describe('shell', () => {
  test('signed out shows the sign-in page without the main nav', () => {
    scene(
      { update, view },
      given(loggedOut),
      expect(role('heading', { name: 'Sign in' })).toExist(),
      expect(role('navigation', { name: 'Main' })).toBeAbsent(),
    )
  })

  test('signed in shows the catalogue page with the current nav link', () => {
    scene(
      { update, view },
      given(loggedInAt(AppRoute.Catalogue())),
      expect(role('heading', { name: 'Catalogue' })).toExist(),
      expect(role('link', { name: 'Catalogue' })).toHaveAttr(
        'aria-current',
        'page',
      ),
    )
  })

  test('the theme toggle shows the current preference', () => {
    scene(
      { update, view },
      given(loggedInAt(AppRoute.Catalogue())),
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
