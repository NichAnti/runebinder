import { Printing } from '../../../../domain'

// The cards the home page shows. An id missing from the catalogue shows as an
// empty frame, so a renamed printing never breaks the page.
export const SHOWCASE = {
  legend: Printing.PrintingId.make('ogn-251-298'),
  champion: Printing.PrintingId.make('ogn-202-298'),
  unit: Printing.PrintingId.make('ogn-036-298'),
  owned: Printing.PrintingId.make('ogn-119-298'),
  needed: Printing.PrintingId.make('ogn-076-298'),
  partly: Printing.PrintingId.make('ogn-255-298'),
  battlefield: Printing.PrintingId.make('ogn-277-298'),
  missing: Printing.PrintingId.make('ogn-030-298'),
  wanted: Printing.PrintingId.make('ogn-205-298'),
  rune: Printing.PrintingId.make('ogn-166-298'),
}

export const SHOWCASE_IDS: ReadonlyArray<Printing.PrintingId> =
  Object.values(SHOWCASE)
