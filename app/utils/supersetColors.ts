const BORDERS = [
  'border-l-sky-500',
  'border-l-amber-500',
  'border-l-emerald-500',
  'border-l-fuchsia-500',
  'border-l-orange-500'
]

export function supersetBorder(index: number | null): string {
  return index === null ? 'border-l-transparent' : BORDERS[index % BORDERS.length]!
}
