import { Effect, Layer } from 'effect'
import { HttpServer } from 'effect/http'
import { HttpApiTest } from 'effect/http-api'

import { assert, layer } from '@effect/vitest'

import { Api, Authentication, CurrentUser } from '../api'
import { User } from '../domain'
import { AccountLive, SystemLive } from './http'

const testUser = User.User.make({
  id: User.UserId.make('user-1'),
  name: 'Ada',
  email: 'ada@example.com',
})

const SignedInAs = (user: User.User) =>
  Layer.succeed(Authentication, httpEffect =>
    Effect.provideService(httpEffect, CurrentUser, user),
  )

const makeClient = HttpApiTest.groups(Api, ['system', 'account'])

const HandlersLayer = Layer.mergeAll(SystemLive, AccountLive).pipe(
  Layer.provideMerge(SignedInAs(testUser)),
)

layer(Layer.mergeAll(HandlersLayer, HttpServer.layerServices))('api', it => {
  it.effect('health returns ok', () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const health = yield* client.system.health()
      assert.deepStrictEqual(health, { ok: true })
    }),
  )

  it.effect('me returns the signed-in user', () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const me = yield* client.account.me()
      assert.deepStrictEqual(me, testUser)
    }),
  )
})
