import { z } from 'zod'
import { LOAD_STYLE_VALUES, TRACKING_TYPE_VALUES, type TrackingType } from '../types/workout'
import { CATEGORY_COLORS } from './categoryColors'

const catalogueExercise = z.object({ externalId: z.string().min(1).max(128) })

const customExercise = z.object({
  externalId: z.string().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(240),
  trackingType: z.enum(TRACKING_TYPE_VALUES),
  loadStyle: z.enum(LOAD_STYLE_VALUES).nullable(),
  barWeight: z.number().positive().max(500).nullable(),
  category: z.object({ name: z.string().trim().min(1).max(64), color: z.enum(CATEGORY_COLORS) })
})

const entry = z.object({
  exercise: z.union([customExercise, catalogueExercise]),
  targetSets: z.number().int().min(1).max(50).nullable(),
  targetLow: z.number().min(0).max(100000).nullable(),
  targetHigh: z.number().min(0).max(100000).nullable(),
  targetWeight: z.number().min(0).max(2000).nullable(),
  supersetGroup: z.number().int().min(1).max(100).nullable(),
  optional: z.boolean(),
  restSeconds: z.number().int().min(0).max(3600).nullable(),
  notes: z.string().max(500).nullable()
})

const routine = z.object({
  name: z.string().trim().min(1).max(255),
  notes: z.string().max(2000).nullable(),
  days: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(255),
        description: z.string().max(255).nullable(),
        floating: z.boolean(),
        entries: z.array(entry).max(100)
      })
    )
    .max(30)
})

const PROGRAM_IMPORT_LIMITS = { entries: 2000, customExercises: 500 } as const

function programEntries(data: { routines: { days: { entries: z.infer<typeof entry>[] }[] }[] }) {
  return data.routines.flatMap((r) => r.days.flatMap((d) => d.entries))
}

function customExerciseCount(data: Parameters<typeof programEntries>[0]): number {
  return new Set(programEntries(data).flatMap((e) => ('name' in e.exercise ? [JSON.stringify(e.exercise)] : []))).size
}

export const programExportSchema = z
  .object({
    format: z.literal('mfj-program'),
    version: z.literal(1),
    program: z.object({
      name: z.string().trim().min(1).max(255),
      description: z.string().max(2000).nullable(),
      phases: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(255),
            weeks: z.number().int().min(1).max(104),
            deload: z.boolean(),
            routine: z.number().int().min(0).nullable()
          })
        )
        .max(52)
    }),
    routines: z.array(routine).max(52)
  })
  .refine(
    (data) => data.program.phases.every((phase) => phase.routine === null || phase.routine < data.routines.length),
    { message: 'A phase points at a routine that is not in the file', path: ['program', 'phases'] }
  )
  .refine((data) => programEntries(data).length <= PROGRAM_IMPORT_LIMITS.entries, {
    message: `A program may hold at most ${PROGRAM_IMPORT_LIMITS.entries} exercise entries`,
    path: ['routines']
  })
  .refine((data) => customExerciseCount(data) <= PROGRAM_IMPORT_LIMITS.customExercises, {
    message: `A program may name at most ${PROGRAM_IMPORT_LIMITS.customExercises} custom exercises`,
    path: ['routines']
  })

export type ProgramExport = z.infer<typeof programExportSchema>
export type ExportExercise = ProgramExport['routines'][number]['days'][number]['entries'][number]['exercise']

export interface OwnExercise {
  id: number
  name: string
  trackingType: TrackingType
}

export function matchImportExercise(
  own: OwnExercise[],
  wanted: { name: string; trackingType: TrackingType }
): { kind: 'match'; id: number } | { kind: 'create'; name: string } {
  const find = (name: string) => own.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase())
  const same = find(wanted.name)
  if (!same) return { kind: 'create', name: wanted.name }
  if (same.trackingType === wanted.trackingType) return { kind: 'match', id: same.id }
  const alias = `${wanted.name} (imported)`
  const copy = find(alias)
  return copy && copy.trackingType === wanted.trackingType
    ? { kind: 'match', id: copy.id }
    : { kind: 'create', name: alias }
}
