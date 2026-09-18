import { z } from 'zod'
import { LOAD_STYLE_VALUES, TRACKING_TYPE_VALUES } from '~~/shared/types/workout'
import { CATEGORY_COLORS } from '~~/shared/utils/categoryColors'

const csv = z.string().transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
const flag = z.enum(['1', 'true', '0', 'false']).transform((v) => v === '1' || v === 'true')

export const exerciseQuerySchema = z.object({
  q: z.string().max(100).default(''),
  categoryId: z.coerce.number().int().positive().optional(),
  muscles: csv.optional(),
  equipment: csv.optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  favorites: flag.optional(),
  includeHidden: flag.optional(),
  limit: z.coerce.number().int().positive().max(1000).optional()
})

export const idParamSchema = z.coerce.number().int().positive()
export const exerciseIdParamSchema = idParamSchema

export const exerciseCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  categoryId: z.number().int().positive(),
  trackingType: z.enum(TRACKING_TYPE_VALUES),
  loadStyle: z.enum(LOAD_STYLE_VALUES).nullish(),
  barWeight: z.number().positive().max(500).nullish(),
  equipment: z.array(z.string()).max(4).default([]),
  primaryMuscles: z.array(z.string()).max(6).default([]),
  secondaryMuscles: z.array(z.string()).max(6).default([]),
  notes: z.string().max(2000).nullish()
})

export const exerciseUpdateSchema = exerciseCreateSchema.partial()

export const exercisePrefsSchema = z.object({
  categoryId: z.number().int().positive().nullable().optional(),
  trackingType: z.enum(TRACKING_TYPE_VALUES).nullable().optional(),
  loadStyle: z.enum(LOAD_STYLE_VALUES).nullable().optional(),
  barWeight: z.number().positive().max(500).nullable().optional(),
  weightIncrement: z.number().positive().max(100).nullable().optional(),
  restSeconds: z.number().int().min(5).max(3600).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  link: z.string().url().max(500).nullable().optional()
})

export type ExerciseCreateInput = z.infer<typeof exerciseCreateSchema>
export type ExerciseUpdateInput = z.infer<typeof exerciseUpdateSchema>
export type ExercisePrefsInput = z.infer<typeof exercisePrefsSchema>

export const categoryListQuerySchema = z.object({
  includeHidden: flag.optional()
})

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(64),
  color: z.enum(CATEGORY_COLORS)
})

export const categoryPatchSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  color: z.enum(CATEGORY_COLORS).optional(),
  sortOrder: z.number().int().min(0).optional(),
  hidden: z.boolean().optional()
})

export const categoryDeleteQuerySchema = z.object({
  moveTo: z.coerce.number().int().positive().optional()
})

export const variationCreateSchema = z.object({
  name: z.string().trim().min(1).max(64),
  exerciseIds: z.array(z.number().int().positive()).max(50).default([])
})

export const variationPatchSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  addExerciseIds: z.array(z.number().int().positive()).max(50).optional(),
  removeExerciseIds: z.array(z.number().int().positive()).max(50).optional()
})

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>
export type CategoryPatchInput = z.infer<typeof categoryPatchSchema>
export type VariationCreateInput = z.infer<typeof variationCreateSchema>
export type VariationPatchInput = z.infer<typeof variationPatchSchema>

export const sessionStartSchema = z.object({
  name: z.string().trim().max(255).nullish(),
  performedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  copyFromId: z.number().int().positive().optional()
})

export const sessionPatchSchema = z.object({
  name: z.string().trim().max(255).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  performedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startedAt: z.iso.datetime().optional(),
  endedAt: z.iso.datetime().nullable().optional(),
  finish: z.boolean().optional()
})

export const sessionListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(20)
})

export type SessionStartInput = z.infer<typeof sessionStartSchema>
export type SessionPatchInput = z.infer<typeof sessionPatchSchema>

export const workoutEntryAddSchema = z.object({ exerciseId: z.number().int().positive() })

export const workoutEntryPatchSchema = z.object({
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(2000).nullable().optional()
})

export type WorkoutEntryAddInput = z.infer<typeof workoutEntryAddSchema>
export type WorkoutEntryPatchInput = z.infer<typeof workoutEntryPatchSchema>

export const setWriteSchema = z.object({
  weight: z.number().min(0).max(2000).nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  distanceMeters: z.number().min(0).max(1000000).nullable().optional(),
  durationSeconds: z.number().int().min(0).max(86400).nullable().optional(),
  done: z.boolean().optional(),
  comment: z.string().max(500).nullable().optional()
})

export type SetWriteInput = z.infer<typeof setWriteSchema>
