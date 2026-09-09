export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const cause = (err as { cause?: { code?: string, constraint?: string } })?.cause
  const code = cause?.code ?? (err as { code?: string })?.code
  if (code !== '23505') return false
  if (!constraint) return true
  const errConstraint = cause?.constraint ?? (err as { constraint?: string })?.constraint
  return errConstraint === constraint
}
