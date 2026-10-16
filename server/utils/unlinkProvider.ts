export function leavesNoSignIn(linked: string[], provider: string): boolean {
  return !linked.some((p) => p !== provider)
}
