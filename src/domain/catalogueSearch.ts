import { Schema } from 'effect'

import { CardId, CardType, Domain } from './printing'

export const CardSummary = Schema.Struct({
  id: CardId,
  name: Schema.String,
  maybeSubtitle: Schema.Option(Schema.String),
  maybeType: Schema.Option(CardType),
  domains: Schema.Array(Domain),
  imageUrl: Schema.String,
  maybeAccessibilityText: Schema.Option(Schema.String),
  printingCount: Schema.Int,
})
export type CardSummary = typeof CardSummary.Type

export const FacetName = Schema.Literals([
  'set',
  'type',
  'supertype',
  'domain',
  'rarity',
  'variant',
  'keyword',
  'tag',
])
export type FacetName = typeof FacetName.Type

export const FacetValue = Schema.Struct({
  value: Schema.String,
  count: Schema.Int,
})
export type FacetValue = typeof FacetValue.Type

export const Facets = Schema.Struct({
  set: Schema.Array(FacetValue),
  type: Schema.Array(FacetValue),
  supertype: Schema.Array(FacetValue),
  domain: Schema.Array(FacetValue),
  rarity: Schema.Array(FacetValue),
  variant: Schema.Array(FacetValue),
  keyword: Schema.Array(FacetValue),
  tag: Schema.Array(FacetValue),
})
export type Facets = typeof Facets.Type

export const SearchResult = Schema.Struct({
  total: Schema.Int,
  cards: Schema.Array(CardSummary),
  facets: Facets,
})
export type SearchResult = typeof SearchResult.Type
