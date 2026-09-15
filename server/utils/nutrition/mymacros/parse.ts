const HEADER = /^(.+)'s Daily Meals - (\d{2})-(\d{2})-(\d{4})\s*$/
const SEPARATOR = /^-{10,}$/
const KEY = /^(Protein|Carbs|Fat|Calories|Total Calories|Total Fat): (-?\d+(?:\.\d+)?)\s*$/
const SERVING = /^Serving Size: (\d+(?:\.\d+)?) (.+?)\s*$/
const COMPOUND = /^(.*?)\s*\((\d+(?:\.\d+)?)\s*g\)$/i
const GRAM_WORDS = new Set(['g', 'gram', 'grams'])
const OUNCE_WORDS = new Set(['oz', 'ounce', 'ounces'])
const POUND_WORDS = new Set(['lb', 'lbs', 'pound', 'pounds'])

export interface ParsedRow {
  container: string
  ordinal: number
  name: string
  quantity: number
  unit: string
  basisGrams: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  raw: string
}

export interface ParsedTotals {
  protein: number
  carbs: number
  fat: number
  kcal: number
}

export interface ParsedDay {
  date: string
  fileName: string
  rows: ParsedRow[]
  containerTotals: Record<string, ParsedTotals>
  dailyTotals: ParsedTotals
}

export function isMyMacrosHeader(line: string): boolean {
  return HEADER.test(line)
}

export class MyMacrosParseError extends Error {
  constructor(public readonly fileName: string, public readonly line: number, message: string) {
    super(`${fileName}:${line}: ${message}`)
    this.name = 'MyMacrosParseError'
  }
}

export function normalizeMmpUnit(raw: string): { unit: string, basisGrams: number | null } {
  let label = raw.trim()
  let basisGrams: number | null = null
  const compound = COMPOUND.exec(label)
  if (compound) {
    label = compound[1]!.trim()
    basisGrams = Number(compound[2])
  }
  const key = label.toLowerCase()
  if (GRAM_WORDS.has(key)) return { unit: 'g', basisGrams }
  if (OUNCE_WORDS.has(key)) return { unit: 'oz', basisGrams }
  if (POUND_WORDS.has(key)) return { unit: 'lb', basisGrams }
  return { unit: label, basisGrams }
}

export function parseMyMacrosExport(text: string, fileName: string): ParsedDay {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  const err = (message: string, at: number): MyMacrosParseError => new MyMacrosParseError(fileName, at + 1, message)

  const headerMatch = HEADER.exec(lines[0] ?? '')
  if (!headerMatch) throw err('missing header', 0)
  const [, , mm, dd, yyyy] = headerMatch
  const date = `${yyyy}-${mm}-${dd}`
  const parsedDate = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw err(`invalid header date "${date}"`, 0)
  }

  let cursor = 1

  const skipBlanks = (): void => {
    while (cursor < lines.length && lines[cursor] === '') cursor++
  }

  const expectSeparator = (): void => {
    const current = lines[cursor] ?? ''
    if (!SEPARATOR.test(current)) throw err(`unexpected line "${current}"`, cursor)
    cursor++
  }

  const readKey = (name: string): number => {
    const current = lines[cursor] ?? ''
    const match = KEY.exec(current)
    if (!match || match[1] !== name) throw err(`unexpected line "${current}"`, cursor)
    cursor++
    return Number(match[2])
  }

  const readBlockTotals = (): ParsedTotals => {
    const protein = readKey('Protein')
    const carbs = readKey('Carbs')
    const fat = readKey('Fat')
    const kcal = readKey('Calories')
    return { protein, carbs, fat, kcal }
  }

  const readEntryTotals = (): ParsedTotals => {
    const kcal = readKey('Total Calories')
    const protein = readKey('Protein')
    const carbs = readKey('Carbs')
    const fat = readKey('Total Fat')
    return { protein, carbs, fat, kcal }
  }

  const rows: ParsedRow[] = []
  const containerTotals: Record<string, ParsedTotals> = {}
  let dailyTotals: ParsedTotals | undefined

  while (dailyTotals === undefined) {
    skipBlanks()
    expectSeparator()
    const title = (lines[cursor] ?? '').trim()
    cursor++
    expectSeparator()

    if (title === 'Daily Totals') {
      dailyTotals = readBlockTotals()
      while (cursor < lines.length) {
        const current = lines[cursor] ?? ''
        if (current !== '') throw err(`unexpected line "${current}"`, cursor)
        cursor++
      }
      break
    }

    const container = title
    const totalsLine = lines[cursor] ?? ''
    if (totalsLine !== 'Totals') throw err(`unexpected line "${totalsLine}"`, cursor)
    cursor++
    containerTotals[container] = readBlockTotals()

    let ordinal = 0
    for (;;) {
      skipBlanks()
      if (cursor >= lines.length) throw err('unexpected end of file', cursor)
      if (SEPARATOR.test(lines[cursor] ?? '')) break

      const nameLine = cursor
      const name = (lines[cursor] ?? '').trim()
      cursor++

      const serving = SERVING.exec(lines[cursor] ?? '')
      if (!serving) throw err(`unexpected line "${lines[cursor] ?? ''}"`, cursor)
      cursor++
      const quantity = Number(serving[1])
      const { unit, basisGrams } = normalizeMmpUnit(serving[2]!)

      const totals = readEntryTotals()
      const raw = lines.slice(nameLine, cursor).join('\n')

      rows.push({
        container,
        ordinal: ordinal++,
        name,
        quantity,
        unit,
        basisGrams,
        kcal: totals.kcal,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        raw
      })
    }
  }

  return { date, fileName, rows, containerTotals, dailyTotals }
}
