import type { ChartRange } from '~~/shared/types/series'

export function useBodyRange() {
  return useState<ChartRange>('body:range', () => 'mtd')
}
