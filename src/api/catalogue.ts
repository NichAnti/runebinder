// The card catalogue lives in the card data bucket, seeded on deploy, and the
// browser loads it from the Backend. Bump CATALOGUE_VERSION to rebuild it from
// the sources: the next deploy seeds the new version and clients load it from
// a new address, so each version can be cached forever.
export const CATALOGUE_VERSION = '2026-11-04'

export const CATALOGUE_PATH = '/api/catalogue'

export const catalogueHref = (version: string): string =>
  `${CATALOGUE_PATH}/${version}`

export const catalogueKey = (version: string): string =>
  `catalogue/${version}/catalogue.json`

export const printingTypesKey = (version: string): string =>
  `catalogue/${version}/printingTypes.json`
