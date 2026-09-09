export interface ExportRow {
  date: string
  logged: boolean
  profileName: string | null
  totals: Record<string, number>
  targets?: Record<string, { amount: number }> | null
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: ExportRow[], nutrientKeys: string[]): string {
  const header = ['date', 'profile', ...nutrientKeys.flatMap((k) => [k, `${k}_target`])].join(',')
  const body = rows.map((row) =>
    [
      cell(row.date),
      cell(row.profileName),
      ...nutrientKeys.flatMap((k) => [cell(row.totals[k]), cell(row.targets?.[k]?.amount)])
    ].join(',')
  )
  return [header, ...body].join('\n')
}
