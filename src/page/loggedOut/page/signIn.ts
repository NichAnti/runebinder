import { Effect, Redacted, Schema } from 'effect'
import { Command, Submodel, type Update } from 'foldkit'
import {
  Field,
  NotValidated,
  Rule,
  allValid,
  makeRules,
  validate,
} from 'foldkit/fieldValidation'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import { User } from '../../../domain'
import { signUpHref } from '../../../route'
import { AuthClient, FailureReason } from '../../../service'
import { Button, Link, TextField } from '../../../ui'
import { Submission, failureView } from '../submission'

// MODEL

export const Model = Schema.Struct({
  email: Field(Schema.String),
  password: Field(Schema.String),
  submission: Submission,
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  email: NotValidated({ value: '' }),
  password: NotValidated({ value: '' }),
  submission: Submission.Idle(),
})

// MESSAGE

export const Message = defineMessageUnion({
  UpdatedEmail: { value: Schema.String },
  UpdatedPassword: { value: Schema.String },
  SubmittedForm: {},
  SucceededSignIn: { user: User.User },
  FailedSignIn: { reason: FailureReason },
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  SignedIn: { user: User.User },
})
export type OutMessage = typeof OutMessage.Type

// VALIDATION

const emailRules = makeRules({
  required: 'Email is required',
  rules: [Rule.email('Enter a valid email')],
})

const passwordRules = makeRules({ required: 'Password is required' })

const validateEmail = validate(emailRules)
const validatePassword = validate(passwordRules)

const isFormValid = (model: Model): boolean =>
  allValid([
    [model.email, emailRules],
    [model.password, passwordRules],
  ])

// COMMAND

export const SignIn = Command.define('SignIn', {
  args: { email: Schema.String, password: Schema.Redacted(Schema.String) },
  messages: [Message.SucceededSignIn, Message.FailedSignIn],
  execute: ({ email, password }) =>
    Effect.gen(function* () {
      const auth = yield* AuthClient
      const user = yield* auth.signIn({
        email,
        password: Redacted.value(password),
      })
      return Message.SucceededSignIn({ user })
    }).pipe(
      Effect.catch(error =>
        Effect.succeed(Message.FailedSignIn({ reason: error.reason })),
      ),
    ),
})

// UPDATE

export const update = (model: Model, message: Message) =>
  Message.match<
    Update.ReturnWithOutMessage<Model, Message, OutMessage, AuthClient>
  >(message, {
    UpdatedEmail: ({ value }) => ({
      model: modifyFields(model, { email: () => validateEmail(value) }),
    }),

    UpdatedPassword: ({ value }) => ({
      model: modifyFields(model, { password: () => validatePassword(value) }),
    }),

    SubmittedForm: () => {
      if (model.submission._tag === 'Submitting') {
        return { model }
      }

      if (!isFormValid(model)) {
        return {
          model: modifyFields(model, {
            email: () => validateEmail(model.email.value),
            password: () => validatePassword(model.password.value),
          }),
        }
      }

      return {
        model: modifyFields(model, {
          submission: () => Submission.Submitting(),
        }),
        commands: [
          SignIn({
            email: model.email.value,
            password: Redacted.make(model.password.value),
          }),
        ],
      }
    },

    SucceededSignIn: ({ user }) => ({
      model: init(),
      outMessage: OutMessage.SignedIn({ user }),
    }),

    FailedSignIn: ({ reason }) => ({
      model: modifyFields(model, {
        submission: () => Submission.Failed({ reason }),
      }),
    }),
  })

// VIEW

export const view = Submodel.defineView<Model, Message>((model, h) => {
  const isSubmitting = model.submission._tag === 'Submitting'

  return h.section(
    [h.Class('flex flex-col gap-6')],
    [
      h.h1([h.Class('text-2xl font-semibold')], ['Sign in']),
      h.form(
        [
          h.Class('flex flex-col gap-4'),
          h.Novalidate(true),
          h.OnSubmit(Message.SubmittedForm()),
        ],
        [
          TextField.view(
            {
              id: 'sign-in-email',
              label: 'Email',
              type: 'email',
              autocomplete: 'email',
              field: model.email,
              onInput: value => Message.UpdatedEmail({ value }),
            },
            h,
          ),
          TextField.view(
            {
              id: 'sign-in-password',
              label: 'Password',
              type: 'password',
              autocomplete: 'current-password',
              field: model.password,
              onInput: value => Message.UpdatedPassword({ value }),
            },
            h,
          ),
          failureView(model.submission, h),
          Button.view(
            { content: ['Sign in'], type: 'submit', isDisabled: isSubmitting },
            h,
          ),
        ],
      ),
      h.p(
        [h.Class('text-sm text-fg-muted')],
        [
          'No account yet? ',
          Link.view({ href: signUpHref(), content: ['Create one'] }, h),
        ],
      ),
    ],
  )
})
