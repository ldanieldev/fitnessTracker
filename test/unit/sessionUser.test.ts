import { describe, expect, it } from 'vitest'
import { toSessionUser } from '../../server/utils/sessionUser'

const row = {
  id: 1,
  email: 'a@example.com',
  name: 'A',
  avatarUrl: null,
  age: 30,
  sex: 'm' as const,
  weekStart: 1,
  defaultRestSeconds: 60,
  plateSizes: ['45', '2.5'],
  oneRepMaxRepCap: 10,
  workoutsPerWeek: 3,
  showBody: true,
  showWorkouts: true,
  showNutrition: true,
  isAdmin: false,
  onboardedAt: null as Date | null
}

describe('toSessionUser', () => {
  it('marks a user without onboarded_at as not onboarded', () => {
    expect(toSessionUser(row).onboarded).toBe(false)
  })

  it('marks a user with onboarded_at as onboarded', () => {
    expect(toSessionUser({ ...row, onboardedAt: new Date() }).onboarded).toBe(true)
  })
})
