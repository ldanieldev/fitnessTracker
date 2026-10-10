export interface StepDay {
  date: string
  steps: number
}

export interface StepTarget {
  dailyTarget: number
  effectiveFrom: string
}

export interface StepWeekDay {
  date: string
  steps: number | null
  target: number | null
}

export interface StepWeek {
  start: string
  end: string
  days: StepWeekDay[]
  total: number
  logged: number
  average: number | null
  budget: number | null
  met: boolean | null
  remaining: number | null
  openDays: number | null
  neededPerDay: number | null
}
