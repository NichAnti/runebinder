import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'

export const Health = Schema.Struct({ ok: Schema.Literal(true) })
export type Health = typeof Health.Type

export class System extends HttpApiGroup.make('system').add(
  HttpApiEndpoint.get('health', '/api/health', { success: Health }),
) {}
