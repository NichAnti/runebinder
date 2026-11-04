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
import { signInRouter } from '../../../route'
import { AuthClient, FailureReason } from '../../../service'
import { Button, Link, TextField } from '../../../ui'
import { Submission, failureView } from '../submission'

const MIN_PASSWORD_LENGTH = 8

// MODEL

export const Model = Schema.Struct({
  name: Field(Schema.String),
  email: Field(Schema.String),
  password: Field(Schema.String),
  inviteCode: Field(Schema.String),
  submission: Submission,
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  name: NotValidated({ value: '' }),
  email: NotValidated({ value: '' }),
  password: NotValidated({ value: '' }),
  inviteCode: NotValidated({ value: '' }),
  submission: Submission.Idle(),
})

// MESSAGE

export const Message = defineMessageUnion({
  UpdatedName: { value: Schema.String },
  UpdatedEmail: { value: Schema.String },
  UpdatedPassword: { value: Schema.String },
  UpdatedInviteCode: { value: Schema.String },
  SubmittedForm: {},
  SucceededSignUp: { user: User.User },
  FailedSignUp: { reason: FailureReason },
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  SignedUp: { user: User.User },
})
export type OutMessage = typeof OutMessage.Type

// VALIDATION

const nameRules = makeRules({ required: 'Display name is required' })

const emailRules = makeRules({
  required: 'Email is required',
  rules: [Rule.email('Enter a valid email')],
})

const passwordRules = makeRules({
  required: 'Password is required',
  rules: [
    Rule.minLength(
      MIN_PASSWORD_LENGTH,
      `Use at least ${MIN_PASSWORD_LENGTH} characters`,
    ),
  ],
})

const inviteCodeRules = makeRules({ required: 'Invite code is required' })

const validateName = validate(nameRules)
const validateEmail = validate(emailRules)
const validatePassword = validate(passwordRules)
const validateInviteCode = validate(inviteCodeRules)

const isFormValid = (model: Model): boolean =>
  allValid([
    [model.name, nameRules],
    [model.email, emailRules],
    [model.password, passwordRules],
    [model.inviteCode, inviteCodeRules],
  ])

// COMMAND

export const SignUp = Command.define('SignUp', {
  args: {
    name: Schema.String,
    email: Schema.String,
    password: Schema.Redacted(Schema.String),
    inviteCode: Schema.Redacted(Schema.String),
  },
  messages: [Message.SucceededSignUp, Message.FailedSignUp],
  execute: ({ name, email, password, inviteCode }) =>
    Effect.gen(function* () {
      const auth = yield* AuthClient
      const user = yield* auth.signUp({ name, email, password, inviteCode })
      return Message.SucceededSignUp({ user })
    }).pipe(
      Effect.catch(error =>
        Effect.succeed(Message.FailedSignUp({ reason: error.reason })),
      ),
    ),
})

// UPDATE

export const update = (model: Model, message: Message) =>
  Message.match<
    Update.ReturnWithOutMessage<Model, Message, OutMessage, AuthClient>
  >(message, {
    UpdatedName: ({ value }) => ({
      model: modifyFields(model, { name: () => validateName(value) }),
    }),

    UpdatedEmail: ({ value }) => ({
      model: modifyFields(model, { email: () => validateEmail(value) }),
    }),

    UpdatedPassword: ({ value }) => ({
      model: modifyFields(model, { password: () => validatePassword(value) }),
    }),

    UpdatedInviteCode: ({ value }) => ({
      model: modifyFields(model, {
        inviteCode: () => validateInviteCode(value),
      }),
    }),

    SubmittedForm: () => {
      if (model.submission._tag === 'Submitting') {
        return { model }
      }

      if (!isFormValid(model)) {
        return {
          model: modifyFields(model, {
            name: () => validateName(model.name.value),
            email: () => validateEmail(model.email.value),
            password: () => validatePassword(model.password.value),
            inviteCode: () => validateInviteCode(model.inviteCode.value),
          }),
        }
      }

      return {
        model: modifyFields(model, {
          submission: () => Submission.Submitting(),
        }),
        commands: [
          SignUp({
            name: model.name.value.trim(),
            email: model.email.value,
            password: Redacted.make(model.password.value),
            inviteCode: Redacted.make(model.inviteCode.value.trim()),
          }),
        ],
      }
    },

    SucceededSignUp: ({ user }) => ({
      model: init(),
      outMessage: OutMessage.SignedUp({ user }),
    }),

    FailedSignUp: ({ reason }) => ({
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
      h.h1([h.Class('text-2xl font-semibold')], ['Create an account']),
      h.p(
        [h.Class('text-sm text-fg-muted')],
        [
          'Sign-up is invite only for now. Ask the person who invited you for the code.',
        ],
      ),
      h.form(
        [
          h.Class('flex flex-col gap-4'),
          h.Novalidate(true),
          h.OnSubmit(Message.SubmittedForm()),
        ],
        [
          TextField.view(
            {
              id: 'sign-up-name',
              label: 'Display name',
              autocomplete: 'nickname',
              field: model.name,
              onInput: value => Message.UpdatedName({ value }),
            },
            h,
          ),
          TextField.view(
            {
              id: 'sign-up-email',
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
              id: 'sign-up-password',
              label: 'Password',
              type: 'password',
              autocomplete: 'new-password',
              field: model.password,
              onInput: value => Message.UpdatedPassword({ value }),
            },
            h,
          ),
          TextField.view(
            {
              id: 'sign-up-invite-code',
              label: 'Invite code',
              autocomplete: 'off',
              field: model.inviteCode,
              onInput: value => Message.UpdatedInviteCode({ value }),
            },
            h,
          ),
          failureView(model.submission, h),
          Button.view(
            {
              content: ['Create account'],
              type: 'submit',
              isDisabled: isSubmitting,
            },
            h,
          ),
        ],
      ),
      h.p(
        [h.Class('text-sm text-fg-muted')],
        [
          'Already have an account? ',
          Link.view({ href: signInRouter(), content: ['Sign in'] }, h),
        ],
      ),
    ],
  )
})
