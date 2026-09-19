import { normalizePlateSizes } from '~~/shared/utils/plates'

export interface PlateLoad {
  perSide: number[]
  total: number
}

export interface LoadPlan {
  belowBar: boolean
  exact: PlateLoad | null
  below: PlateLoad | null
  above: PlateLoad | null
}

const SCALE = 100
const MAX_SIDE_UNITS = 1000 * SCALE

function toUnits(value: number): number {
  return Math.round(value * SCALE)
}

// Unbounded fewest-coins search: greedy misses loads such as 60 = 35 + 25 when a 45 is available.
function fewestPlates(units: number[], limit: number) {
  const count = new Int32Array(limit + 1).fill(-1)
  const last = new Int32Array(limit + 1)
  count[0] = 0
  for (let amount = 1; amount <= limit; amount++) {
    for (const unit of units) {
      if (unit > amount || count[amount - unit]! < 0) continue
      const next = count[amount - unit]! + 1
      if (count[amount]! < 0 || next < count[amount]!) {
        count[amount] = next
        last[amount] = unit
      }
    }
  }
  return { count, last }
}

// Largest-first is the load people expect at a rack; the DP below only rescues weights it cannot hit.
function greedyPlates(units: number[], amount: number): number[] | null {
  const perSide: number[] = []
  let rest = amount
  for (const unit of units) {
    for (let taken = Math.floor(rest / unit); taken > 0; taken--) perSide.push(unit)
    rest %= unit
  }
  return rest === 0 ? perSide : null
}

export function loadPlan(target: number, bar: number, sizes: number[]): LoadPlan {
  const barUnits = toUnits(bar)
  const targetUnits = toUnits(target)
  if (targetUnits < barUnits) return { belowBar: true, exact: null, below: null, above: null }
  // Caps the DP arrays: a mistyped six-digit target would otherwise allocate hundreds of MB.
  if (targetUnits - barUnits > 2 * MAX_SIDE_UNITS) return { belowBar: false, exact: null, below: null, above: null }

  const units = normalizePlateSizes(sizes).map(toUnits).filter((unit) => unit > 0)
  const side = (targetUnits - barUnits) / 2
  const limit = Math.ceil(side) + (units[0] ?? 0)
  const { count, last } = fewestPlates(units, limit)

  const fewest = (amount: number) => {
    const perSide: number[] = []
    for (let rest = amount; rest > 0; rest -= last[rest]!) perSide.push(last[rest]!)
    return perSide.sort((a, b) => b - a)
  }

  const load = (amount: number): PlateLoad => {
    const perSide = greedyPlates(units, amount) ?? fewest(amount)
    return { perSide: perSide.map((unit) => unit / SCALE), total: (barUnits + 2 * amount) / SCALE }
  }

  if (Number.isInteger(side) && count[side]! >= 0) {
    return { belowBar: false, exact: load(side), below: null, above: null }
  }
  let low = Math.floor(side)
  while (count[low]! < 0) low--
  let high = Math.ceil(side)
  while (high <= limit && count[high]! < 0) high++
  return { belowBar: false, exact: null, below: load(low), above: high <= limit ? load(high) : null }
}

export function roundToLoadable(target: number, bar: number, sizes: number[]): number {
  const plan = loadPlan(target, bar, sizes)
  if (plan.belowBar) return bar
  if (plan.exact) return plan.exact.total
  if (!plan.above) return plan.below!.total
  return target - plan.below!.total <= plan.above.total - target ? plan.below!.total : plan.above.total
}

export function roundToIncrement(target: number, step: number): number {
  const down = Math.floor(target / step + 1e-9) * step
  const up = down + step
  const picked = target - down <= up - target ? down : up
  return Math.round(picked * SCALE) / SCALE
}
