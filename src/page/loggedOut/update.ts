import { Effect, Option } from 'effect'
import { Command, Update } from 'foldkit'
import { replaceUrl } from 'foldkit/navigation'
import { modifyFields } from 'foldkit/struct'

import { type LoggedOutRoute, signUpHref } from '../../route'
import type { AuthClient } from '../../service'
import { Message, OutMessage } from './message'
import type { Model } from './model'
import * as Home from './page/home'
import * as SignIn from './page/signIn'
import * as SignUp from './page/signUp'

const homeSlot = {
  read: (model: Model) => Option.some(model.home),
  write: (model: Model, nextHome: Home.Model): Model =>
    modifyFields(model, { home: () => nextHome }),
  toParentMessage: (message: Home.Message) =>
    Message.GotHomeMessage({ message }),
}

const foldHome = Update.foldChild({ update: Home.update, ...homeSlot })

const enterHome = Update.foldChildStep({ update: Home.enter, ...homeSlot })

// Once an invite link has filled in the code, the code leaves the address bar
// so it is not left on screen or in a copied link.
export const ForgetInvite = Command.define('ForgetInvite', {
  messages: [Message.CompletedForgetInvite],
  execute: replaceUrl(signUpHref()).pipe(
    Effect.as(Message.CompletedForgetInvite()),
  ),
})

export const enterRoute = (
  model: Model,
  route: LoggedOutRoute,
): Update.Return<Model, Message> => {
  const nextModel = modifyFields(model, { route: () => route })

  if (route._tag === 'Home') {
    return enterHome(nextModel)
  }

  if (route._tag === 'SignUp') {
    return Option.match(route.invite, {
      onNone: () => ({ model: nextModel }),
      onSome: inviteCode => ({
        model: modifyFields(nextModel, {
          signUp: signUp => SignUp.withInviteCode(signUp, inviteCode),
        }),
        commands: [ForgetInvite()],
      }),
    })
  }

  return { model: nextModel }
}

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
    GotHomeMessage: ({ message }) => foldHome(model, message),
    CompletedForgetInvite: () => ({ model }),
    GotSignInMessage: ({ message }) => foldSignIn(model, message),
    GotSignUpMessage: ({ message }) => foldSignUp(model, message),
  })
