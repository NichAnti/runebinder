import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { reasonFor } from './auth'

describe('reasonFor', () => {
  test.each([
    ['INVALID_EMAIL_OR_PASSWORD', 'InvalidCredentials'],
    ['USER_ALREADY_EXISTS', 'EmailTaken'],
    ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'EmailTaken'],
    ['PASSWORD_TOO_SHORT', 'WeakPassword'],
    ['PASSWORD_TOO_LONG', 'WeakPassword'],
    ['INVALID_INVITE_CODE', 'InvalidInviteCode'],
    ['SOMETHING_ELSE', 'Unknown'],
  ])('%s becomes %s', (code, reason) => {
    expect(reasonFor(Option.some(code))).toBe(reason)
  })

  test('a missing code is Unknown', () => {
    expect(reasonFor(Option.none())).toBe('Unknown')
  })
})
