export interface ExerciseSearchDocument {
  id: number
  name: string
  is_catalog: boolean
  owner_id: number | null
}

interface ExerciseRowForIndex {
  id: number
  name: string
  createdByUserId: number | null
}

export const EXERCISE_SEARCH_INDEX = 'exercises'

export const EXERCISE_SEARCH_INDEX_SETTINGS = {
  searchableAttributes: ['name'],
  filterableAttributes: ['is_catalog', 'owner_id'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness']
}

export function exerciseToSearchDocument(row: ExerciseRowForIndex): ExerciseSearchDocument {
  return {
    id: row.id,
    name: row.name,
    is_catalog: row.createdByUserId === null,
    owner_id: row.createdByUserId
  }
}

export function exerciseVisibilityFilter(userId: number): string {
  return `is_catalog = true OR owner_id = ${userId}`
}
