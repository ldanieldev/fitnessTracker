import { and, eq, isNull } from 'drizzle-orm'
import { exercises } from '~~/server/db/schema'
import { db } from '../db'
import { MeiliIndexProvider } from '../search/meiliIndex'
import {
  EXERCISE_SEARCH_INDEX,
  EXERCISE_SEARCH_INDEX_SETTINGS,
  exerciseToSearchDocument,
  exerciseVisibilityFilter,
  type ExerciseSearchDocument
} from './searchDocuments'
import type { ExerciseSearchProvider } from './searchProvider'

const INDEX_COLUMNS = { id: exercises.id, name: exercises.name, createdByUserId: exercises.createdByUserId }

export class ExerciseMeiliProvider
  extends MeiliIndexProvider<ExerciseSearchDocument>
  implements ExerciseSearchProvider {
  constructor(host: string, apiKey: string) {
    super(host, apiKey, {
      name: EXERCISE_SEARCH_INDEX,
      settings: EXERCISE_SEARCH_INDEX_SETTINGS,
      visibleTo: exerciseVisibilityFilter
    })
  }

  protected async loadDocument(exerciseId: number): Promise<ExerciseSearchDocument | null> {
    const row = await db
      .select(INDEX_COLUMNS)
      .from(exercises)
      .where(and(eq(exercises.id, exerciseId), isNull(exercises.deletedAt)))
      .limit(1)
      .then((r) => r[0])
    return row ? exerciseToSearchDocument(row) : null
  }

  protected async loadAllDocuments(): Promise<ExerciseSearchDocument[]> {
    const rows = await db.select(INDEX_COLUMNS).from(exercises).where(isNull(exercises.deletedAt))
    return rows.map((row) => exerciseToSearchDocument(row))
  }
}
