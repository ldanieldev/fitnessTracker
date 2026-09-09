export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && 'data' in error
    ? ((error as { data?: { statusMessage?: string } }).data?.statusMessage ?? fallback)
    : fallback
}
