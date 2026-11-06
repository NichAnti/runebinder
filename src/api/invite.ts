// Sign-up is invite only: the browser sends the invite code in this header and
// the Backend answers a missing or wrong code with this error code, in Better
// Auth's error shape, before Better Auth sees the request.
export const INVITE_CODE_HEADER = 'x-invite-code'

export const INVALID_INVITE_CODE = 'INVALID_INVITE_CODE'
