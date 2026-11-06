import { betterAuth } from 'better-auth'
import { drizzle } from 'drizzle-orm/sqlite-proxy'

import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'

export const auth = betterAuth({
  database: drizzleAdapter(
    drizzle(async () => ({ rows: [] })),
    { provider: 'sqlite' },
  ),
  emailAndPassword: { enabled: true },
})
