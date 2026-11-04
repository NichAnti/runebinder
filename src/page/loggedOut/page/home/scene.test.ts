import { Option } from 'effect'
import { expect, given, role, scene, selector } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { printing } from '../../../../testing'
import { Showcase, init } from './model'
import { SHOWCASE } from './showcase'
import { update } from './update'
import { view } from './view'

const legend = printing({
  id: SHOWCASE.legend,
  maybeType: Option.some('Legend'),
})

describe('home page', () => {
  test('explains the app in four sections', () => {
    scene(
      { update, view },
      given(init()),
      expect(role('heading', { level: 1 })).toExist(),
      expect(role('region', { name: 'Browse and track cards' })).toExist(),
      expect(role('region', { name: 'Build decks' })).toExist(),
      expect(role('region', { name: 'Automatic wishlists' })).toExist(),
      expect(role('region', { name: 'Buy on CardTrader' })).toExist(),
    )
  })

  test('leads to sign up and sign in', () => {
    scene(
      { update, view },
      given(init()),
      expect(role('link', { name: 'Create a free account' })).toHaveAttr(
        'href',
        '/sign-up',
      ),
      expect(role('link', { name: 'Sign in' })).toHaveAttr('href', '/sign-in'),
    )
  })

  test('shows the real cards once they load', () => {
    scene(
      { update, view },
      given(init()),
      expect(selector(`img[src="${legend.imageUrl}"]`)).toBeAbsent(),
    )
    scene(
      { update, view },
      given({
        showcase: Showcase.Ready({ printings: { [legend.id]: legend } }),
      }),
      expect(selector(`img[src="${legend.imageUrl}"]`)).toExist(),
    )
  })
})
