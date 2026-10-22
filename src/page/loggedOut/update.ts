import { Option } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import type { AuthClient } from '../../service'
import { Message, OutMessage } from './message'
import type { Model } from './model'
import * as SignIn from './page/signIn'
import * as SignUp from './page/signUp'

const foldSignIn = Update.foldChild({
  update: SignIn.update,
  read: (model: Model) => Option.some(model.signIn),
  write: (model, nextSignIn) =>
    modifyFields(model, { signIn: () => nextSignIn }),
  toParentMessage: message => Message.GotSignInMessage({ message }),
  toParentOutMessage: SignIn.OutMessage.match<OutMessage>({
    SignedIn: ({ user }) => OutMessage.SignedIn({ user }),
  }),
})

const foldSignUp = Update.foldChild({
  update: SignUp.update,
  read: (model: Model) => Option.some(model.signUp),
  write: (model, nextSignUp) =>
    modifyFields(model, { signUp: () => nextSignUp }),
  toParentMessage: message => Message.GotSignUpMessage({ message }),
  toParentOutMessage: SignUp.OutMessage.match<OutMessage>({
    SignedUp: ({ user }) => OutMessage.SignedIn({ user }),
  }),
})

export const update = (model: Model, message: Message) =>
  Message.match<
    Update.ReturnWithOutMessage<Model, Message, OutMessage, AuthClient>
  >(message, {
    GotSignInMessage: ({ message }) => foldSignIn(model, message),
    GotSignUpMessage: ({ message }) => foldSignUp(model, message),
  })
