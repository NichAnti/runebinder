import { Match, Schema } from 'effect'

export const Preference = Schema.Literals(['System', 'Light', 'Dark'])
export type Preference = typeof Preference.Type

export const Resolved = Schema.Literals(['Light', 'Dark'])
export type Resolved = typeof Resolved.Type

export const PreferenceJson = Schema.fromJsonString(Preference)

export const resolve = (preference: Preference, system: Resolved): Resolved =>
  Match.value(preference).pipe(
    Match.withReturnType<Resolved>(),
    Match.when('Light', () => 'Light'),
    Match.when('Dark', () => 'Dark'),
    Match.when('System', () => system),
    Match.exhaustive,
  )

export const next = (preference: Preference): Preference =>
  Match.value(preference).pipe(
    Match.withReturnType<Preference>(),
    Match.when('System', () => 'Light'),
    Match.when('Light', () => 'Dark'),
    Match.when('Dark', () => 'System'),
    Match.exhaustive,
  )
