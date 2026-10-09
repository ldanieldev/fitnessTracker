export const CATEGORY_COLORS = [
  'rose', 'amber', 'orange', 'violet', 'emerald', 'sky', 'slate', 'cyan', 'lime', 'pink', 'teal', 'indigo'
] as const

export type CategoryColor = (typeof CATEGORY_COLORS)[number]

// Tailwind can't see dynamic bg-${color}-500 class names, so every colour is mapped to a literal class.
export const CATEGORY_DOT_CLASS: Record<string, string> = {
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  slate: 'bg-slate-500',
  cyan: 'bg-cyan-500',
  lime: 'bg-lime-500',
  pink: 'bg-pink-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
  fallback: 'bg-gray-500'
}
