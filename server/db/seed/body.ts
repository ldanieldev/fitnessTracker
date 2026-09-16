import { isNull, sql } from 'drizzle-orm'
import type { MeasurementDirection } from '../../../shared/types/body'
import { db } from '../../utils/db'
import { measurementTypes } from '../schema'

export interface MeasurementTypeSeed {
  userId: null
  key: string
  name: string
  unit: string
  precision: number
  direction: MeasurementDirection
}

export const MEASUREMENT_TYPE_SEED: MeasurementTypeSeed[] = [
  { userId: null, key: 'bodyweight', name: 'Bodyweight', unit: 'lbs', precision: 1, direction: 'neutral' },
  { userId: null, key: 'body_fat', name: 'Body Fat', unit: '%', precision: 2, direction: 'lower' },
  { userId: null, key: 'waist', name: 'Waist', unit: 'in', precision: 1, direction: 'lower' }
]

export async function seedMeasurementTypes() {
  await db
    .insert(measurementTypes)
    .values(MEASUREMENT_TYPE_SEED)
    .onConflictDoUpdate({
      target: measurementTypes.key,
      targetWhere: isNull(measurementTypes.userId),
      set: {
        name: sql`excluded.name`,
        unit: sql`excluded.unit`,
        precision: sql`excluded.precision`,
        direction: sql`excluded.direction`
      }
    })
}
