import { Effect, Schema, Stream } from 'effect'
import { Dom, Subscription } from 'foldkit'

import { DARK_COLOR_SCHEME_QUERY } from './constant'
import { Message } from './message'
import type { Model } from './model'

export const subscriptions = Subscription.make<Model, Message>()(entry => ({
  systemTheme: entry(
    { isSystemPreference: Schema.Boolean },
    {
      modelToDependencies: model => ({
        isSystemPreference: model.themePreference === 'System',
      }),
      dependenciesToStream: ({ isSystemPreference }) =>
        Stream.when(
          Dom.streamFromMediaQuery({
            query: DARK_COLOR_SCHEME_QUERY,
            mapMatches: isDark =>
              Message.ChangedSystemTheme({ theme: isDark ? 'Dark' : 'Light' }),
          }),
          Effect.sync(() => isSystemPreference),
        ),
    },
  ),
}))
