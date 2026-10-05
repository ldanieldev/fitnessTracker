export const START_WHEN_VALUES = ['now', 'next'] as const
export type StartWhen = (typeof START_WHEN_VALUES)[number]

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'abandoned'
export type EnrollmentNotice = 'phase' | 'complete'

export interface PhaseSpan {
  id: number
  weeks: number
}

export interface PositionInput<P extends PhaseSpan> {
  anchorDate: string
  anchorWeek: number
  weekStart: 0 | 1
  today: string
  phases: P[]
}

export interface ProgramPosition<P extends PhaseSpan> {
  state: 'between' | 'current' | 'finished'
  week: number
  totalWeeks: number
  phase: P | null
  phaseIndex: number
  weekInPhase: number
}

export interface ProgramSummary {
  id: number
  name: string
  phaseCount: number
  totalWeeks: number
  enrolled: boolean
}

export interface ProgramPhase {
  id: number
  name: string
  sortOrder: number
  weeks: number
  deload: boolean
  routine: { id: number; name: string; dayCount: number } | null
}

export interface Program {
  id: number
  name: string
  description: string | null
  totalWeeks: number
  phases: ProgramPhase[]
}

export interface Enrollment {
  id: number
  program: { id: number; name: string }
  status: EnrollmentStatus
  state: 'between' | 'current' | 'paused' | 'finished'
  week: number
  totalWeeks: number
  phaseIndex: number
  weekInPhase: number
  phase: ProgramPhase | null
  phases: ProgramPhase[]
  anchorDate: string
  notice: EnrollmentNotice | null
  nextDay: { id: number; name: string } | null
}

export interface ProgramImportResult {
  programId: number
  exercises: { matched: number; created: string[] }
}

export interface SessionProgramTag {
  phaseId: number
  phaseName: string
  phaseIndex: number
  week: number
}
