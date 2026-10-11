export interface SearchCandidate {
  id: number
  name: string
  relevance: number
}

export interface RerankSignals {
  favorites: Set<number>
  usage: Map<number, number>
}

export interface SearchHit extends SearchCandidate {
  isFavorite: boolean
  logCount: number
}

// Personal signal stays in Postgres so logging never touches the search engine (spec section 8).
export function rerank(candidates: SearchCandidate[], signals: RerankSignals): SearchHit[] {
  return candidates
    .map((c) => ({
      ...c,
      isFavorite: signals.favorites.has(c.id),
      logCount: signals.usage.get(c.id) ?? 0
    }))
    .sort(
      (a, b) =>
        Number(b.isFavorite) - Number(a.isFavorite) ||
        b.logCount - a.logCount ||
        b.relevance - a.relevance ||
        a.id - b.id
    )
}
