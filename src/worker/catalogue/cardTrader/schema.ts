import { Schema } from 'effect'

export const Blueprint = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  version: Schema.NullOr(Schema.String),
  game_id: Schema.Int,
  category_id: Schema.Int,
  expansion_id: Schema.Int,
  fixed_properties: Schema.Struct({
    collector_number: Schema.optionalKey(Schema.NullOr(Schema.String)),
    riftbound_rarity: Schema.optionalKey(Schema.String),
  }),
  editable_properties: Schema.Array(Schema.Unknown),
  card_market_ids: Schema.Array(Schema.Unknown),
  tcg_player_id: Schema.NullOr(Schema.Int),
  scryfall_id: Schema.NullOr(Schema.String),
  image_url: Schema.String,
  image: Schema.NullOr(Schema.Unknown),
  back_image: Schema.NullOr(Schema.Unknown),
})
export type Blueprint = typeof Blueprint.Type

export const BlueprintExport = Schema.Array(Blueprint)
