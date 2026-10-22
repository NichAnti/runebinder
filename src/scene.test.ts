import { expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import { AppRoute } from './route'
import { update } from './update'
import { view } from './view'

describe('shell', () => {
  test('signed out shows the sign-in page', () => {
    scene(
      { update, view },
      given(Model.make({ auth: LoggedOut.init(AppRoute.SignIn()) })),
      expect(role('heading', { name: 'Sign in' })).toExist(),
    )
  })

  test('signed in shows the catalogue page', () => {
    scene(
      { update, view },
      given(Model.make({ auth: LoggedIn.init(AppRoute.Catalogue()) })),
      expect(role('heading', { name: 'Catalogue' })).toExist(),
    )
  })

  test('not found shows the path and a way back', () => {
    scene(
      { update, view },
      given(
        Model.make({
          auth: LoggedIn.init(AppRoute.NotFound({ path: '/nope' })),
        }),
      ),
      expect(text('Nothing lives at /nope.')).toExist(),
      expect(role('link', { name: 'Go to catalogue' })).toExist(),
    )
  })
})
