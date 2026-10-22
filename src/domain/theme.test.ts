import { describe, expect, test } from 'vitest'

import * as Theme from './theme'

describe('resolve', () => {
  test('an explicit preference wins over the system theme', () => {
    expect(Theme.resolve('Light', 'Dark')).toBe('Light')
    expect(Theme.resolve('Dark', 'Light')).toBe('Dark')
  })

  test('System follows the system theme', () => {
    expect(Theme.resolve('System', 'Dark')).toBe('Dark')
    expect(Theme.resolve('System', 'Light')).toBe('Light')
  })
})

describe('next', () => {
  test('cycles System, Light, Dark and back to System', () => {
    expect(Theme.next('System')).toBe('Light')
    expect(Theme.next('Light')).toBe('Dark')
    expect(Theme.next('Dark')).toBe('System')
  })
})
