import { Match } from 'effect'
import { Submodel } from 'foldkit'

import { signInRouter } from '../../route'
import * as NotFound from '../notFound'
import { Message } from './message'
import type { Model } from './model'
import * as SignIn from './page/signIn'
import * as SignUp from './page/signUp'

export const view = Submodel.defineView<Model, Message>((model, h) =>
  h.main(
    [h.Class('mx-auto flex max-w-md flex-col px-4 py-16')],
    [
      Match.value(model.route).pipe(
        Match.tagsExhaustive({
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
