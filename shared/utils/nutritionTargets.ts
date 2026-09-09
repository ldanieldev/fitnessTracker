import type { TargetDirection } from '../types/nutrition'

export type TargetState = 'met' | 'under' | 'over'

export interface TargetInput {
  consumed: number
  target: number
  direction: TargetDirection
  tolerance?: number
}

export interface TargetEvaluation {
  remaining: number
  state: TargetState
  progress: number
}

export function evaluateTarget(input: TargetInput): TargetEvaluation {
  const { consumed, target, direction, tolerance = 0.05 } = input
  const raw = target - consumed
  const progress = target <= 0 ? (consumed > 0 ? 1 : 0) : Math.min(consumed / target, 1)

  if (direction === 'min') {
    return { remaining: Math.max(raw, 0), state: raw > 0 ? 'under' : 'met', progress }
  }

  if (direction === 'max') {
    return { remaining: raw, state: raw < 0 ? 'over' : 'met', progress }
  }

  const band = Math.abs(target) * tolerance
  const state: TargetState = Math.abs(raw) <= band ? 'met' : consumed > target ? 'over' : 'under'
  return { remaining: raw, state, progress }
}
