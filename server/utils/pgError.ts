function pgCode(err: unknown): string | undefined {
  const cause = (err as { cause?: { code?: string } })?.cause
  return cause?.code ?? (err as { code?: string })?.code
}

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (pgCode(err) !== '23505') return false
  if (!constraint) return true
  const cause = (err as { cause?: { constraint?: string } })?.cause
  const errConstraint = cause?.constraint ?? (err as { constraint?: string })?.constraint
  return errConstraint === constraint
}

export function isForeignKeyViolation(err: unknown): boolean {
  return pgCode(err) === '23503'
}
