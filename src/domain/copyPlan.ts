import { Option } from 'effect'

export type Target = 'Main' | 'Sideboard' | 'Other'

export type Placement = Readonly<{
  main: number
  sideboard: number
  champion: number
  other: number
}>

export type Addition = 'Add' | 'MoveFromMain' | 'MoveFromSideboard'

const isUnderLimit = (
  copies: number,
  maybeLimit: Option.Option<number>,
): boolean =>
  Option.match(maybeLimit, {
    onNone: () => true,
    onSome: limit => copies < limit,
  })

export const additionTo = (
  target: Target,
  placement: Placement,
  maybeLimit: Option.Option<number>,
  targetRoom: number,
): Option.Option<Addition> => {
  const total = placement.main + placement.sideboard + placement.champion

  if (targetRoom <= 0) {
    return Option.none()
  } else if (target === 'Other') {
    return isUnderLimit(placement.other, maybeLimit)
      ? Option.some('Add')
      : Option.none()
  } else if (target === 'Main') {
    if (isUnderLimit(total, maybeLimit)) {
      return Option.some('Add')
    } else if (placement.sideboard > 0) {
      return Option.some('MoveFromSideboard')
    } else {
      return Option.none()
    }
  } else if (isUnderLimit(total, maybeLimit)) {
    return Option.some('Add')
  } else if (placement.main > 0) {
    return Option.some('MoveFromMain')
  } else {
    return Option.none()
  }
}
