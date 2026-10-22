import { User } from './domain'

export const ada = User.User.make({
  id: User.UserId.make('user-ada'),
  name: 'Ada',
  email: 'ada@example.com',
})
