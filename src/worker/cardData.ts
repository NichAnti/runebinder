import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'

// The private bucket that holds the card catalogue, which is never committed.
// Every environment uses this one bucket, local dev included (`remote()`), so
// the catalogue is uploaded once for all of them: the first deploy or dev run
// creates and seeds it, later ones find it, and destroying a stage keeps it.
export const CardDataBucket = Cloudflare.R2.Bucket('CardData', {
  name: 'runebinder-data',
}).pipe(Alchemy.RemovalPolicy.retain(), Alchemy.remote())
