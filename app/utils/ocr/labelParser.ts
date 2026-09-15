import type { NutrientKey } from '~~/shared/types/nutrition'

export interface ParsedLabel {
  servingGrams: number | null
  nutrients: Partial<Record<NutrientKey, number>>
  confidence: number
}

const ALL_KEYS: NutrientKey[] = [
  'energy', 'protein', 'carbohydrate', 'fat', 'fiber', 'sugar', 'saturatedFat', 'cholesterol', 'sodium', 'potassium'
]

const DIGITS = '[0-9lLiIoO]'
const MASS_VALUE = new RegExp(`(${DIGITS}+(?:[.,]${DIGITS}+)?)\\s*(mg|g|q)\\b`, 'i')
const GRAM_VALUE = new RegExp(`(${DIGITS}+(?:[.,]${DIGITS}+)?)\\s*(g|q)\\b`, 'i')
const KCAL_VALUE = new RegExp(`(${DIGITS}+(?:[.,]${DIGITS}+)?)\\s*kcal\\b`, 'i')
const KJ_VALUE = new RegExp(`(${DIGITS}+(?:[.,]${DIGITS}+)?)\\s*kj\\b`, 'i')
const PLAIN_VALUE = new RegExp(`(${DIGITS}+(?:[.,]${DIGITS}+)?)`)

const LABELS: Partial<Record<NutrientKey, RegExp>> = {
  fat: /^(total\s+)?fat\b/i,
  saturatedFat: /saturat(ed|es)\b/i,
  carbohydrate: /^(total\s+)?carb(ohydrate)?s?\b/i,
  fiber: /fib(er|re)\b/i,
  sugar: /sugars?\b/i,
  protein: /protein\b/i,
  cholesterol: /cholesterol\b/i,
  potassium: /potassium\b/i,
  sodium: /sodium\b/i
}

const SALT_LABEL = /salt\b/i
const SERVING_SIZE_LABEL = /serving\s*size/i
const ENERGY_LABEL = /calories|energy/i

function toNumber(raw: string): number {
  const normalized = raw.replace(/[lLiI]/g, '1').replace(/[oO]/g, '0').replace(/,/g, '.')
  return Number.parseFloat(normalized)
}

function extractAfterLabel(line: string, labelRegex: RegExp, valueRegex: RegExp): number | null {
  const labelMatch = line.match(labelRegex)
  if (!labelMatch || labelMatch.index === undefined) return null
  const remainder = line.slice(labelMatch.index + labelMatch[0].length)
  const valueMatch = remainder.match(valueRegex)
  return valueMatch ? toNumber(valueMatch[1]!) : null
}

function extractField(lines: string[], labelRegex: RegExp, valueRegex: RegExp): number | null {
  for (const line of lines) {
    const value = extractAfterLabel(line, labelRegex, valueRegex)
    if (value !== null && !Number.isNaN(value)) return value
  }
  return null
}

function extractEnergy(lines: string[]): number | null {
  const line = lines.find((candidate) => ENERGY_LABEL.test(candidate))
  if (!line) return null
  const kcalMatch = line.match(KCAL_VALUE)
  if (kcalMatch) return toNumber(kcalMatch[1]!)
  const kjMatch = line.match(KJ_VALUE)
  if (kjMatch) return Math.round(toNumber(kjMatch[1]!) / 4.184)
  return extractAfterLabel(line, ENERGY_LABEL, PLAIN_VALUE)
}

function extractServingGrams(lines: string[]): number | null {
  const line = lines.find((candidate) => SERVING_SIZE_LABEL.test(candidate))
  if (!line) return null
  const parenMatch = line.match(new RegExp(`\\((${DIGITS}+(?:[.,]${DIGITS}+)?)\\s*g\\)`, 'i'))
  if (parenMatch) return toNumber(parenMatch[1]!)
  const direct = extractAfterLabel(line, SERVING_SIZE_LABEL, MASS_VALUE)
  if (direct !== null) return direct
  const bareParenMatch = line.match(/\((\d+)\)/)
  if (bareParenMatch && bareParenMatch[1]!.endsWith('9')) {
    const grams = Number.parseInt(bareParenMatch[1]!.slice(0, -1), 10)
    if (grams >= 1 && grams < 500) return grams
  }
  return null
}

export function parseNutritionLabel(text: string): ParsedLabel {
  const lines = text.split('\n')
  const nutrients: Partial<Record<NutrientKey, number>> = {}

  const set = (key: NutrientKey, value: number | null) => {
    if (value !== null && !Number.isNaN(value)) nutrients[key] = value
  }

  set('energy', extractEnergy(lines))
  for (const key of ['fat', 'saturatedFat', 'carbohydrate', 'fiber', 'sugar', 'protein', 'cholesterol', 'potassium'] as const) {
    set(key, extractField(lines, LABELS[key]!, MASS_VALUE))
  }

  let sodiumFromSalt = false
  let sodium = extractField(lines, LABELS.sodium!, MASS_VALUE)
  if (sodium === null) {
    const saltGrams = extractField(lines, SALT_LABEL, GRAM_VALUE)
    if (saltGrams !== null) {
      sodium = saltGrams * 400
      sodiumFromSalt = true
    }
  }
  set('sodium', sodium)

  const matched = ALL_KEYS.filter((key) => nutrients[key] !== undefined).length
  let confidence = matched / ALL_KEYS.length
  if (sodiumFromSalt) confidence -= 0.1
  confidence = Math.max(0, Math.round(confidence * 100) / 100)

  return {
    servingGrams: extractServingGrams(lines),
    nutrients,
    confidence
  }
}
