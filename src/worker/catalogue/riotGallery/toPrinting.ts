import { Array, Match, Number, Option, Result, Schema, pipe } from 'effect'

import { Printing } from '../../../domain'
import { CatalogueIssue } from '../issue'
import {
  type GalleryCard,
  type GalleryCardType,
  type GalleryDomain,
  type GalleryRarity,
  type GallerySupertype,
} from './schema'

const ID_PATTERN = /^([a-z]+)-(r|sp|t)?(\d+)(a)?(-star)?(?:-(\d+))?$/

type IdParts = Readonly<{
  set: string
  number: number
  isAlternateArt: boolean
  isSigned: boolean
  maybeSetSize: Option.Option<number>
}>

export const parseId = (id: string): Option.Option<IdParts> =>
  pipe(
    Option.fromNullishOr(ID_PATTERN.exec(id)),
    Option.flatMap(([, set, , number, alternateArt, star, setSize]) =>
      Option.all({
        set: Option.fromNullishOr(set),
        number: Number.parse(number ?? ''),
      }).pipe(
        Option.map(({ set, number }) => ({
          set,
          number,
          isAlternateArt: alternateArt !== undefined,
          isSigned: star !== undefined,
          maybeSetSize: Number.parse(setSize ?? ''),
        })),
      ),
    ),
  )

export const variantFor = (parts: IdParts): Printing.Variant => {
  if (parts.isSigned) {
    return 'Signature'
  } else if (parts.isAlternateArt) {
    return 'AlternateArt'
  } else if (
    Option.exists(parts.maybeSetSize, setSize => parts.number > setSize)
  ) {
    return 'Overnumbered'
  } else {
    return 'Base'
  }
}

const toCardType = (type: GalleryCardType): Printing.CardType =>
  Match.value(type).pipe(
    Match.withReturnType<Printing.CardType>(),
    Match.when('unit', () => 'Unit'),
    Match.when('spell', () => 'Spell'),
    Match.when('legend', () => 'Legend'),
    Match.when('gear', () => 'Gear'),
    Match.when('battlefield', () => 'Battlefield'),
    Match.when('rune', () => 'Rune'),
    Match.exhaustive,
  )

const toSupertype = (supertype: GallerySupertype): Printing.Supertype =>
  Match.value(supertype).pipe(
    Match.withReturnType<Printing.Supertype>(),
    Match.when('champion', () => 'Champion'),
    Match.when('signature', () => 'Signature'),
    Match.when('basic', () => 'Basic'),
    Match.when('token', () => 'Token'),
    Match.exhaustive,
  )

const toRarity = (rarity: GalleryRarity): Printing.Rarity =>
  Match.value(rarity).pipe(
    Match.withReturnType<Printing.Rarity>(),
    Match.when('common', () => 'Common'),
    Match.when('uncommon', () => 'Uncommon'),
    Match.when('rare', () => 'Rare'),
    Match.when('epic', () => 'Epic'),
    Match.when('showcase', () => 'Showcase'),
    Match.exhaustive,
  )

const toDomain = (domain: GalleryDomain): Printing.Domain =>
  Match.value(domain).pipe(
    Match.withReturnType<Printing.Domain>(),
    Match.when('fury', () => 'Fury'),
    Match.when('calm', () => 'Calm'),
    Match.when('mind', () => 'Mind'),
    Match.when('body', () => 'Body'),
    Match.when('chaos', () => 'Chaos'),
    Match.when('order', () => 'Order'),
    Match.when('colorless', () => 'Colorless'),
    Match.exhaustive,
  )

const toOrientation = (
  orientation: GalleryCard['orientation'],
): Printing.Orientation =>
  Match.value(orientation).pipe(
    Match.withReturnType<Printing.Orientation>(),
    Match.when('portrait', () => 'Portrait'),
    Match.when('landscape', () => 'Landscape'),
    Match.exhaustive,
  )

const statOf = (
  field: GalleryCard['energy'] | undefined,
): Option.Option<number> =>
  Option.map(Option.fromNullishOr(field), ({ value }) => value.id)

const richTextOf = (
  field: GalleryCard['text'] | undefined,
): Option.Option<string> =>
  Option.map(Option.fromNullishOr(field), ({ richText }) => richText.body)

const check = (
  isValid: boolean,
  issue: () => CatalogueIssue,
): Result.Result<void, CatalogueIssue> =>
  isValid ? Result.void : Result.fail(issue())

export const toPrinting = (
  card: GalleryCard,
): Result.Result<Printing.Printing, CatalogueIssue> =>
  Result.gen(function* () {
    const parts = yield* Result.fromOption(parseId(card.id), () =>
      CatalogueIssue.cases.InvalidId.make({ id: card.id }),
    )

    yield* check(parts.set === card.set.value.id.toLowerCase(), () =>
      CatalogueIssue.cases.IdMismatch.make({
        id: card.id,
        field: 'set',
        expected: parts.set,
        actual: card.set.value.id,
      }),
    )

    yield* check(parts.number === card.collectorNumber, () =>
      CatalogueIssue.cases.IdMismatch.make({
        id: card.id,
        field: 'collectorNumber',
        expected: `${parts.number}`,
        actual: `${card.collectorNumber}`,
      }),
    )

    yield* check(card.cardType.type.length <= 1, () =>
      CatalogueIssue.cases.MultipleTypes.make({ id: card.id }),
    )

    const maybeSubtitle = Option.fromNullishOr(card.subtitle)

    const cardId = yield* Result.fromOption(
      Printing.cardIdFor(card.name, maybeSubtitle),
      () =>
        CatalogueIssue.cases.InvalidCardName.make({
          id: card.id,
          name: card.name,
        }),
    )

    const id = yield* Result.fromOption(
      Schema.decodeOption(Printing.PrintingId)(card.id),
      () => CatalogueIssue.cases.InvalidId.make({ id: card.id }),
    )

    const set = yield* Result.fromOption(
      Schema.decodeOption(Printing.SetCode)(card.set.value.id),
      () =>
        CatalogueIssue.cases.IdMismatch.make({
          id: card.id,
          field: 'set',
          expected: parts.set.toUpperCase(),
          actual: card.set.value.id,
        }),
    )

    return Printing.Printing.make({
      id,
      cardId,
      set,
      collectorNumber: card.collectorNumber,
      publicCode: card.publicCode,
      variant: variantFor(parts),
      name: card.name,
      maybeSubtitle,
      maybeType: pipe(
        Array.head(card.cardType.type),
        Option.map(({ id }) => toCardType(id)),
      ),
      supertypes: Array.map(card.cardType.superType ?? [], ({ id }) =>
        toSupertype(id),
      ),
      rarity: toRarity(card.rarity.value.id),
      domains: Array.map(card.domain.values, ({ id }) => toDomain(id)),
      maybeEnergy: statOf(card.energy),
      maybeMight: statOf(card.might),
      maybeMightBonus: statOf(card.mightBonus),
      maybePower: statOf(card.power),
      tags: card.tags?.tags ?? [],
      maybeText: richTextOf(card.text),
      maybeEffect: richTextOf(card.effect),
      artists: Array.map(card.illustrator.values, ({ label }) => label),
      imageUrl: card.cardImage.url,
      maybeAccessibilityText: Option.fromNullishOr(
        card.cardImage.accessibilityText,
      ),
      orientation: toOrientation(card.orientation),
    })
  })
