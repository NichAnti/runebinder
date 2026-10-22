import { Array, Option, Record, Schema, String, pipe } from 'effect'

export const PrintingId = Schema.String.check(
  Schema.isPattern(/^[a-z]+-(?:r|sp|t)?\d+a?(?:-star)?(?:-\d+)?$/),
).pipe(Schema.brand('PrintingId'))
export type PrintingId = typeof PrintingId.Type

export const CardId = Schema.String.check(
  Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
).pipe(Schema.brand('CardId'))
export type CardId = typeof CardId.Type

export const SetCode = Schema.String.check(Schema.isPattern(/^[A-Z]+$/)).pipe(
  Schema.brand('SetCode'),
)
export type SetCode = typeof SetCode.Type

export const Variant = Schema.Literals([
  'Base',
  'AlternateArt',
  'Signature',
  'Overnumbered',
])
export type Variant = typeof Variant.Type

export const Domain = Schema.Literals([
  'Fury',
  'Calm',
  'Mind',
  'Body',
  'Chaos',
  'Order',
  'Colorless',
])
export type Domain = typeof Domain.Type

export const CardType = Schema.Literals([
  'Unit',
  'Spell',
  'Legend',
  'Gear',
  'Battlefield',
  'Rune',
])
export type CardType = typeof CardType.Type

export const Supertype = Schema.Literals([
  'Champion',
  'Signature',
  'Basic',
  'Token',
])
export type Supertype = typeof Supertype.Type

export const Rarity = Schema.Literals([
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Showcase',
])
export type Rarity = typeof Rarity.Type

export const Orientation = Schema.Literals(['Portrait', 'Landscape'])
export type Orientation = typeof Orientation.Type

export const Printing = Schema.Struct({
  id: PrintingId,
  cardId: CardId,
  set: SetCode,
  collectorNumber: Schema.Int,
  publicCode: Schema.String,
  variant: Variant,
  name: Schema.String,
  maybeSubtitle: Schema.Option(Schema.String),
  maybeType: Schema.Option(CardType),
  supertypes: Schema.Array(Supertype),
  rarity: Rarity,
  domains: Schema.Array(Domain),
  maybeEnergy: Schema.Option(Schema.Int),
  maybeMight: Schema.Option(Schema.Int),
  maybeMightBonus: Schema.Option(Schema.Int),
  maybePower: Schema.Option(Schema.Int),
  tags: Schema.Array(Schema.String),
  maybeText: Schema.Option(Schema.String),
  maybeEffect: Schema.Option(Schema.String),
  artists: Schema.Array(Schema.String),
  imageUrl: Schema.String,
  maybeAccessibilityText: Schema.Option(Schema.String),
  orientation: Orientation,
})
export type Printing = typeof Printing.Type

export const Card = Schema.Struct({
  id: CardId,
  printings: Schema.NonEmptyArray(Printing),
})
export type Card = typeof Card.Type

const slugify = (text: string): string =>
  pipe(
    text,
    String.normalize('NFKD'),
    String.toLowerCase,
    String.replace(/[\u0300-\u036f]/g, ''),
    String.replace(/[^a-z0-9]+/g, '-'),
    String.replace(/^-+|-+$/g, ''),
  )

export const cardIdFor = (
  name: string,
  maybeSubtitle: Option.Option<string>,
): Option.Option<CardId> => {
  const slug = slugify(
    Option.match(maybeSubtitle, {
      onNone: () => name,
      onSome: subtitle => `${name} ${subtitle}`,
    }),
  )

  return Schema.decodeOption(CardId)(slug)
}

export const groupByCard = (
  printings: ReadonlyArray<Printing>,
): ReadonlyArray<Card> =>
  pipe(
    printings,
    Array.groupBy(printing => printing.cardId),
    Record.values,
    Array.map(group => ({
      id: Array.headNonEmpty(group).cardId,
      printings: group,
    })),
  )

export const basePrinting = (card: Card): Printing =>
  pipe(
    card.printings,
    Array.findFirst(printing => printing.variant === 'Base'),
    Option.getOrElse(() => Array.headNonEmpty(card.printings)),
  )

const SET_RELEASE_ORDER: ReadonlyArray<string> = [
  'OGN',
  'OGS',
  'SFD',
  'UNL',
  'VEN',
  'RAD',
]

const COLLECTOR_NUMBER_SLOTS = 1000

export const setReleaseRank = (set: string): number =>
  pipe(
    Array.findFirstIndex(SET_RELEASE_ORDER, released => released === set),
    Option.getOrElse(() => Array.length(SET_RELEASE_ORDER)),
  )

export const collectionOrder = (printing: Printing): number =>
  setReleaseRank(printing.set) * COLLECTOR_NUMBER_SLOTS +
  printing.collectorNumber
