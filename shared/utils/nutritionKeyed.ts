export function keyNutrients(byId: Record<number, number>, idToKey: Map<number, string>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, amount] of Object.entries(byId)) {
    const key = idToKey.get(Number(id))
    if (key) out[key] = amount
  }
  return out
}

export function sumKeyed(lines: Array<{ nutrients: Record<string, number> }>): Record<string, number> {
  const total: Record<string, number> = {}
  for (const line of lines) {
    for (const [key, amount] of Object.entries(line.nutrients)) total[key] = (total[key] ?? 0) + amount
  }
  return total
}
