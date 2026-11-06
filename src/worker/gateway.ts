import type { WebsiteEnv } from '../../alchemy.run'

type Env = WebsiteEnv & {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export type Target = 'Api' | 'Assets'

export const targetFor = (pathname: string): Target =>
  pathname === '/api' || pathname.startsWith('/api/') ? 'Api' : 'Assets'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (targetFor(pathname) === 'Api') {
      return env.API.fetch(request)
    } else {
      return env.ASSETS.fetch(request)
    }
  },
}
