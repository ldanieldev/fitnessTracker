import { csvCell } from './csv'

export interface ExportRow {
  date: string
  logged: boolean
  incomplete: boolean
  profileName: string | null
  totals: Record<string, number>
  targets?: Record<string, { amount: number }> | null
}

export function toCsv(rows: ExportRow[], nutrientKeys: string[]): string {
  const header = ['date', 'profile', 'incomplete', ...nutrientKeys.flatMap((k) => [k, `${k}_target`])].join(',')
  const body = rows.map((row) =>
    [
      csvCell(row.date),
      csvCell(row.profileName),
      row.incomplete ? 'true' : 'false',
      ...nutrientKeys.flatMap((k) => [csvCell(row.totals[k]), csvCell(row.targets?.[k]?.amount)])
    ].join(',')
  )
  return [header, ...body].join('\n')
}
