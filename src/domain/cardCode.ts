import { Option, Schema, String, pipe } from 'effect'

import { PrintingId } from './printing'

export const CardCode = Schema.String.check(
  Schema.isPattern(/^[A-Z]+-(?:R|SP)?\d+[abs]?$/),
).pipe(Schema.brand('CardCode'))
export type CardCode = typeof CardCode.Type

const PRINTING_PARTS = /^([a-z]+)-(r|sp|t)?(\d+)(a)?(-star)?(?:-\d+)?$/
const NORMAL_WIDTH = 3
const RUNE_WIDTH = 2
const SIGNED_SUFFIX = '*'
const SIGNED_CODE = 's'

const numberFor = (prefix: string | undefined, digits: string) => {
  if (prefix === 'r') {
    return Option.some(`R${String.padStart(RUNE_WIDTH, '0')(digits)}`)
  } else if (prefix === 'sp') {
    return Option.some(`SP${globalThis.String(globalThis.Number(digits))}`)
  } else if (prefix === undefined) {
    return Option.some(String.padStart(NORMAL_WIDTH, '0')(digits))
  } else {
    return Option.none()
  }
}

export const cardCodeOf = (id: PrintingId): Option.Option<CardCode> =>
  pipe(
    Option.fromNullishOr(PRINTING_PARTS.exec(id)),
    Option.flatMap(([, set, prefix, digits, alternateArt, star]) =>
      Option.flatMap(numberFor(prefix, digits ?? ''), number =>
        Schema.decodeOption(CardCode)(
          `${String.toUpperCase(set ?? '')}-${number}${alternateArt ?? ''}${star === undefined ? '' : SIGNED_CODE}`,
        ),
      ),
    ),
  )

export const normalizeCardCode = (raw: string): Option.Option<CardCode> =>
  Schema.decodeOption(CardCode)(
    String.endsWith(SIGNED_SUFFIX)(raw)
      ? `${String.slice(0, -1)(raw)}${SIGNED_CODE}`
      : raw,
  )
