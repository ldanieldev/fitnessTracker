import type { TargetDirection } from '../types/nutrition'
import { deriveEnergy } from './nutritionDerive'

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

export function ensureEnergyTarget<T extends { key: string, amount: number, direction: TargetDirection }>(
  targets: T[],
  make: (amount: number) => T,
  calories?: number | null
): T[] {
  if (targets.some((t) => t.key === 'energy')) return targets
  if (typeof calories === 'number' && calories > 0) return [...targets, make(calories)]

  const byKey = new Map(targets.map((t) => [t.key, t.amount]))
  const protein = byKey.get('protein')
  const carbohydrate = byKey.get('carbohydrate')
  const fat = byKey.get('fat')
  if (protein === undefined || carbohydrate === undefined || fat === undefined) return targets

  const derived = deriveEnergy({ protein, carbohydrate, fat })
  if (derived === null) return targets
  return [...targets, make(Math.round(derived))]
}
