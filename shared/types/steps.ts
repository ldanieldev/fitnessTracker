export interface StepDay {
  date: string
  steps: number
  partial: boolean
}

export interface StepTarget {
  dailyTarget: number
  effectiveFrom: string
}

export interface StepWeekDay {
  date: string
  steps: number | null
  partial: boolean
  target: number | null
}

export interface StepWeek {
  start: string
  end: string
  days: StepWeekDay[]
  total: number
  logged: number
  partial: number
  average: number | null
  budget: number | null
  met: boolean | null
  remaining: number | null
  openDays: number | null
  neededPerDay: number | null
}
