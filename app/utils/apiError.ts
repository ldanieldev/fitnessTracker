export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && 'data' in error
    ? ((error as { data?: { statusMessage?: string } }).data?.statusMessage ?? fallback)
    : fallback
}

export const errorCode = (err: unknown) => (err as { data?: { data?: { code?: string } } }).data?.data?.code
