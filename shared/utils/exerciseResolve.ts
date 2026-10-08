import type {
  CatalogueExerciseRow,
  CategoryPrefRow,
  CategoryRow,
  Exercise,
  ExerciseCategory,
  ExercisePrefRow,
  ExerciseRow,
  LoadStyle
} from '../types/workout'
import { WEIGHT_TRACKING_TYPES } from './exerciseLabels'

function num(value: string | null): number | null {
  const parsed = value === null ? Number.NaN : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function resolveCategory(row: CategoryRow, pref: CategoryPrefRow | null): ExerciseCategory {
  return {
    id: row.id,
    key: row.key,
    name: pref?.name ?? row.name,
    color: pref?.color ?? row.color,
    sortOrder: pref?.sortOrder ?? row.sortOrder,
    shared: row.userId === null,
    hidden: pref?.hiddenAt != null
  }
}

export function effectiveLoadStyle(
  row: Pick<ExerciseRow, 'trackingType' | 'loadStyle'>,
  pref: Pick<ExercisePrefRow, 'trackingType' | 'loadStyle'> | null
): LoadStyle | null {
  const trackingType = pref?.trackingType ?? row.trackingType
  // EL-R29: null means inherit, so a non-weight tracking type could never clear an inherited load style on its own.
  return WEIGHT_TRACKING_TYPES.includes(trackingType) ? (pref?.loadStyle ?? row.loadStyle) : null
}

export function resolveExercise(
  row: CatalogueExerciseRow,
  pref: ExercisePrefRow | null,
  category: ExerciseCategory
): Exercise {
  const trackingType = pref?.trackingType ?? row.trackingType
  const loadStyle = effectiveLoadStyle(row, pref)
  const barWeightRaw = pref?.barWeight ?? row.barWeight
  return {
    id: row.id,
    name: row.name,
    category,
    trackingType,
    loadStyle,
    barWeight: loadStyle === 'barbell' ? num(barWeightRaw) : null,
    weightIncrement: num(pref?.weightIncrement ?? null),
    restSeconds: pref?.restSeconds ?? null,
    plateSizes: loadStyle === 'barbell' && pref?.plateSizes ? pref.plateSizes.map(Number) : null,
    difficulty: row.difficulty,
    equipment: row.equipment,
    primaryMuscles: row.primaryMuscles,
    secondaryMuscles: row.secondaryMuscles,
    images: row.images,
    notes: pref?.notes ?? null,
    link: pref?.link ?? null,
    favorite: pref?.favorite ?? false,
    hidden: pref?.hiddenAt != null,
    shared: row.createdByUserId === null,
    defaultGraph: pref?.defaultGraph ?? null,
    overridden: {
      category: pref?.categoryId != null,
      trackingType: pref?.trackingType != null,
      loadStyle: pref?.loadStyle != null,
      barWeight: pref?.barWeight != null
    }
  }
}
