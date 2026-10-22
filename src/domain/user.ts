import { Schema } from 'effect'

export const UserId = Schema.String.pipe(Schema.brand('UserId'))
export type UserId = typeof UserId.Type

export const User = Schema.Struct({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
})
export type User = typeof User.Type
