import { describe, expect, test } from 'vitest'

import { targetFor } from './gateway'

describe('targetFor', () => {
  test.each(['/api', '/api/health', '/api/auth/sign-in'])(
    '%s goes to the API',
    pathname => {
      expect(targetFor(pathname)).toBe('Api')
    },
  )

  test.each(['/', '/sign-in', '/apiary', '/cards/OGN-001'])(
    '%s goes to the assets',
    pathname => {
      expect(targetFor(pathname)).toBe('Assets')
    },
  )
})
