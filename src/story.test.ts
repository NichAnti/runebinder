import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { fromString } from 'foldkit/url'
import { describe, expect, test } from 'vitest'

import { CatalogueQuery } from './domain'
import { Message } from './message'
import { Model } from './model'
import { LoggedIn, LoggedOut } from './page'
import * as SignIn from './page/loggedOut/page/signIn'
import { AppRoute } from './route'
import { ada } from './testing'
import {
  ApplyTheme,
  RedirectToCatalogue,
  RedirectToSignIn,
  SaveThemePreference,
  SignOut,
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
  auth: LoggedIn.init(AppRoute.Catalogue(CatalogueQuery.empty), ada),
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

  test('a signed-out user can open the sign-up page', () => {
    story(
      update,
      given(loggedOut),
      message(
        Message.ChangedUrl({ url: urlOrThrow('http://localhost/sign-up') }),
      ),
      Command.expectNone(),
      model(next => {
        expect(next.auth.route).toStrictEqual(AppRoute.SignUp())
      }),
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

describe('session', () => {
  test('signing in switches to the signed-in area and opens the catalogue', () => {
    story(
      update,
      given(loggedOut),
      message(
        Message.GotLoggedOutMessage({
          message: LoggedOut.Message.GotSignInMessage({
            message: SignIn.Message.SucceededSignIn({ user: ada }),
          }),
        }),
      ),
      model(next => {
        expect(next.auth).toStrictEqual(
          LoggedIn.init(AppRoute.Catalogue(CatalogueQuery.empty), ada),
        )
      }),
      Command.expectExact(RedirectToCatalogue),
      Command.resolve(RedirectToCatalogue, Message.CompletedNavigateInternal()),
    )
  })

  test('signing out returns to the sign-in page', () => {
    story(
      update,
      given(loggedIn),
      message(Message.ClickedSignOut()),
      Command.expectExact(SignOut),
      Command.resolve(SignOut, Message.SucceededSignOut()),
      model(next => {
        expect(next.auth).toStrictEqual(LoggedOut.init(AppRoute.SignIn()))
      }),
      Command.expectExact(RedirectToSignIn),
      Command.resolve(RedirectToSignIn, Message.CompletedNavigateInternal()),
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
