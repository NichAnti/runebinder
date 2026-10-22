import { Effect, Layer } from 'effect'
import { HttpServer } from 'effect/http'
import { HttpApiTest } from 'effect/http-api'

import { assert, layer } from '@effect/vitest'

import { Api } from '../api'
import { SystemLive } from './http'

const makeClient = HttpApiTest.groups(Api, ['system'])

layer(Layer.mergeAll(SystemLive, HttpServer.layerServices))('system', it => {
  it.effect('health returns ok', () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const health = yield* client.system.health()
      assert.deepStrictEqual(health, { ok: true })
    }),
  )
})
