import { defineMessageUnion } from 'foldkit/message'

import { User } from '../../domain'
import * as SignIn from './page/signIn'
import * as SignUp from './page/signUp'

export const Message = defineMessageUnion({
  GotSignInMessage: { message: SignIn.Message },
  GotSignUpMessage: { message: SignUp.Message },
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  SignedIn: { user: User.User },
})
export type OutMessage = typeof OutMessage.Type
