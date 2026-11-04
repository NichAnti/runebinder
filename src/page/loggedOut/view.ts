import { Match } from 'effect'
import { Submodel } from 'foldkit'

import { signInRouter } from '../../route'
import * as NotFound from '../notFound'
import { Message } from './message'
import type { Model } from './model'
import * as Home from './page/home'
import * as SignIn from './page/signIn'
import * as SignUp from './page/signUp'

const narrow = 'mx-auto flex w-full max-w-md flex-col px-4 py-16'

export const view = Submodel.defineView<Model, Message>((model, h) =>
  h.main(
    [
      h.Class(
        model.route._tag === 'Home'
          ? 'mx-auto flex w-full max-w-6xl flex-col px-4 py-12 sm:py-16'
          : narrow,
      ),
    ],
    [
      Match.value(model.route).pipe(
        Match.tagsExhaustive({
          Home: () =>
            h.submodel({
              slotId: 'home',
              model: model.home,
              view: Home.view,
              toParentMessage: message => Message.GotHomeMessage({ message }),
            }),
          SignIn: () =>
            h.submodel({
              slotId: 'sign-in',
              model: model.signIn,
              view: SignIn.view,
              toParentMessage: message => Message.GotSignInMessage({ message }),
            }),
          SignUp: () =>
            h.submodel({
              slotId: 'sign-up',
              model: model.signUp,
              view: SignUp.view,
              toParentMessage: message => Message.GotSignUpMessage({ message }),
            }),
          NotFound: ({ path }) =>
            NotFound.view(
              { path, backHref: signInRouter(), backLabel: 'Go to sign in' },
              h,
            ),
        }),
      ),
    ],
  ),
)
