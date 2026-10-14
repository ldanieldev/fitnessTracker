import { FitNotesParseError, parseFitNotesCsv, type FitNotesRow } from '~~/shared/utils/fitnotes'

export function parseFitNotesOr400(csv: string): FitNotesRow[] {
  try {
    const rows = parseFitNotesCsv(csv)
    if (rows.length === 0) throw new FitNotesParseError('The export has no sets in it')
    return rows
  } catch (err) {
    if (err instanceof FitNotesParseError) throw createError({ statusCode: 400, statusMessage: err.message })
    throw err
  }
}
