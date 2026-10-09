function terms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

export function matchesTerms(name: string, query: string): boolean {
  const lowerName = name.toLowerCase()
  return terms(query).every(term => lowerName.includes(term))
}

export function rankExercise(name: string, query: string, favorite: boolean): number {
  const [term] = terms(query)
  const lowerName = name.toLowerCase()
  let positionScore = 20
  if (term) {
    if (lowerName.startsWith(term)) positionScore = 0
    else if (lowerName.split(/\s+/).some(word => word.startsWith(term))) positionScore = 10
  }
  return (favorite ? 0 : 100) + positionScore
}
