import { Schema } from 'effect'

const Dimensions = Schema.Struct({
  width: Schema.Int,
  height: Schema.Int,
  aspectRatio: Schema.Finite,
})

const Colors = Schema.Struct({
  primary: Schema.String,
  secondary: Schema.String,
  label: Schema.String,
})

const Image = Schema.Struct({
  type: Schema.Literal('image'),
  provider: Schema.String,
  url: Schema.String,
  accessibilityText: Schema.optionalKey(Schema.String),
  dimensions: Schema.optionalKey(Dimensions),
  colors: Schema.optionalKey(Colors),
  mimeType: Schema.optionalKey(Schema.String),
})

const Labelled = <Id extends Schema.Top>(id: Id) =>
  Schema.Struct({
    id,
    label: Schema.String,
    icon: Schema.optionalKey(Image),
  })

const Field = <Value extends Schema.Top>(value: Value) =>
  Schema.Struct({ label: Schema.String, value })

const NumberField = Field(Labelled(Schema.Int))

const RichText = Schema.Struct({
  label: Schema.String,
  richText: Schema.Struct({
    type: Schema.Literal('html'),
    body: Schema.String,
  }),
})

export const GalleryCardType = Schema.Literals([
  'unit',
  'spell',
  'legend',
  'gear',
  'battlefield',
  'rune',
])
export type GalleryCardType = typeof GalleryCardType.Type

export const GallerySupertype = Schema.Literals([
  'champion',
  'signature',
  'basic',
  'token',
])
export type GallerySupertype = typeof GallerySupertype.Type

export const GalleryRarity = Schema.Literals([
  'common',
  'uncommon',
  'rare',
  'epic',
  'showcase',
])
export type GalleryRarity = typeof GalleryRarity.Type

export const GalleryDomain = Schema.Literals([
  'fury',
  'calm',
  'mind',
  'body',
  'chaos',
  'order',
  'colorless',
])
export type GalleryDomain = typeof GalleryDomain.Type

export const GalleryCard = Schema.Struct({
  id: Schema.String,
  collectorNumber: Schema.Int,
  name: Schema.String,
  subtitle: Schema.optionalKey(Schema.String),
  set: Field(Schema.Struct({ id: Schema.String, label: Schema.String })),
  cardType: Schema.Struct({
    label: Schema.String,
    type: Schema.Array(Labelled(GalleryCardType)),
    superType: Schema.optionalKey(Schema.Array(Labelled(GallerySupertype))),
  }),
  publicCode: Schema.String,
  rarity: Field(Labelled(GalleryRarity)),
  domain: Schema.Struct({
    label: Schema.String,
    values: Schema.Array(Labelled(GalleryDomain)),
  }),
  cardImage: Image,
  orientation: Schema.Literals(['portrait', 'landscape']),
  illustrator: Schema.Struct({
    label: Schema.String,
    values: Schema.Array(Labelled(Schema.String)),
  }),
  text: Schema.optionalKey(RichText),
  effect: Schema.optionalKey(RichText),
  energy: Schema.optionalKey(NumberField),
  might: Schema.optionalKey(NumberField),
  mightBonus: Schema.optionalKey(NumberField),
  power: Schema.optionalKey(NumberField),
  tags: Schema.optionalKey(
    Schema.Struct({ label: Schema.String, tags: Schema.Array(Schema.String) }),
  ),
})
export type GalleryCard = typeof GalleryCard.Type

export const GalleryPage = Schema.Struct({
  data: Schema.Array(Schema.Unknown),
  metadata: Schema.Struct({
    channelMachineName: Schema.String,
    channelHostname: Schema.String,
    smartListMachineName: Schema.String,
    from: Schema.Int,
    limit: Schema.Int,
    overrideSize: Schema.Int,
    totalItems: Schema.Int,
    totalPages: Schema.Int,
    locale: Schema.String,
    resultsUpdatedAt: Schema.String,
  }),
  linkdata: Schema.Struct({
    first: Schema.String,
    last: Schema.String,
    self: Schema.String,
    next: Schema.optionalKey(Schema.String),
    prev: Schema.optionalKey(Schema.String),
  }),
})
export type GalleryPage = typeof GalleryPage.Type
