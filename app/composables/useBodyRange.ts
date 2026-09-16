import type { BodyRange } from '~~/shared/types/body'

export function useBodyRange() {
  return useState<BodyRange>('body:range', () => 'mtd')
}
