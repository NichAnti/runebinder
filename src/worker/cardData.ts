import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'

// The private bucket that holds the card catalogue, which is never committed.
// Every stage declares the same bucket: the first deploy creates it, later ones
// find it, and destroying a stage keeps it.
export const CardDataBucket = Cloudflare.R2.Bucket('CardData', {
  name: 'runebinder-data',
}).pipe(Alchemy.RemovalPolicy.retain())
