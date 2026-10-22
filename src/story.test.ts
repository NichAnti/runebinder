import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { fromString } from 'foldkit/url'
import { describe, expect, test } from 'vitest'

import { Message } from './message'
import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import { AppRoute } from './route'
import {
  ApplyTheme,
  RedirectToCatalogue,
  RedirectToSignIn,
  SaveThemePreference,
  update,
} from './update'

const urlOrThrow = (raw: string) =>
  Option.getOrThrowWith(fromString(raw), () => new Error(`Bad url: ${raw}`))

const loggedOut = Model.make({
  auth: LoggedOut.init(AppRoute.SignIn()),
  themePreference: 'System',
  systemTheme: 'Light',
})

const loggedIn = Model.make({
  auth: LoggedIn.init(AppRoute.Catalogue()),
  themePreference: 'System',
  systemTheme: 'Light',
})

describe('ChangedUrl', () => {
  test('a signed-out user on a signed-in route is redirected to sign in', () => {
    story(
      update,
      given(loggedOut),
      message(Message.ChangedUrl({ url: urlOrThrow('http://localhost/') })),
      Command.expectExact(RedirectToSignIn),
      Command.resolve(RedirectToSignIn, Message.CompletedNavigateInternal()),
    )
  })

  test('a signed-in user on the sign-in route is redirected to the catalogue', () => {
    story(
      update,
      given(loggedIn),
      message(
        Message.ChangedUrl({ url: urlOrThrow('http://localhost/sign-in') }),
      ),
      Command.expectExact(RedirectToCatalogue),
      Command.resolve(RedirectToCatalogue, Message.CompletedNavigateInternal()),
    )
  })

  test('an unknown path becomes NotFound within the current area', () => {
    story(
      update,
      given(loggedIn),
      message(Message.ChangedUrl({ url: urlOrThrow('http://localhost/nope') })),
      Command.expectNone(),
      model(next => {
        expect(next.auth.route).toStrictEqual(
          AppRoute.NotFound({ path: '/nope' }),
        )
      }),
    )
  })
})

describe('theme', () => {
  test('the toggle moves to the next preference, applies and saves it', () => {
    story(
      update,
      given(loggedOut),
      message(Message.ClickedThemeToggle()),
      model(next => {
        expect(next.themePreference).toBe('Light')
      }),
      Command.expectHas(
        ApplyTheme({ theme: 'Light' }),
        SaveThemePreference({ preference: 'Light' }),
      ),
      Command.resolveAll(
        [ApplyTheme, Message.CompletedApplyTheme()],
        [SaveThemePreference, Message.CompletedSaveThemePreference()],
      ),
    )
  })

  test('a system theme change is applied while the preference is System', () => {
    story(
      update,
      given(loggedOut),
      message(Message.ChangedSystemTheme({ theme: 'Dark' })),
      model(next => {
        expect(next.systemTheme).toBe('Dark')
      }),
      Command.expectHas(ApplyTheme({ theme: 'Dark' })),
      Command.resolve(ApplyTheme, Message.CompletedApplyTheme()),
    )
  })
})
