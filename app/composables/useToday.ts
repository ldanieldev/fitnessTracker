export function useToday() {
  return useState<string | null>('today', () => null)
}
