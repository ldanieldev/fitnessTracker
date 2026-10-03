import { csvCell } from './csv'

export interface ExportRow {
  date: string
  logged: boolean
  profileName: string | null
  totals: Record<string, number>
  targets?: Record<string, { amount: number }> | null
}

export function toCsv(rows: ExportRow[], nutrientKeys: string[]): string {
  const header = ['date', 'profile', ...nutrientKeys.flatMap((k) => [k, `${k}_target`])].join(',')
  const body = rows.map((row) =>
    [
      csvCell(row.date),
      csvCell(row.profileName),
      ...nutrientKeys.flatMap((k) => [csvCell(row.totals[k]), csvCell(row.targets?.[k]?.amount)])
    ].join(',')
  )
  return [header, ...body].join('\n')
}
