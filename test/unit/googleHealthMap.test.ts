import { describe, expect, it } from 'vitest'
import hrv from '../fixtures/googleHealth/hrv.json'
import restingHr from '../fixtures/googleHealth/restingHr.json'
import sleep from '../fixtures/googleHealth/sleep.json'
import steps from '../fixtures/googleHealth/steps.json'
import {
  lbsToGrams,
  localDay,
  mainSleepEnds,
  mapHrv,
  mapRestingHr,
  mapSleepSessions,
  mapSteps,
  pickOwnPoint,
  sleepHours
} from '../../server/utils/googleHealth/map'

describe('localDay', () => {
  it('shifts the UTC instant by the offset before taking the date', () => {
    expect(localDay('2026-10-16T03:30:00Z', '-18000s')).toBe('2026-10-15')
    expect(localDay('2026-10-15T12:20:00Z', '-18000s')).toBe('2026-10-15')
    expect(localDay('2026-10-15T23:30:00Z', '3600s')).toBe('2026-10-16')
    expect(localDay('2026-10-15T23:30:00Z', undefined)).toBe('2026-10-15')
  })

  it('treats an unparseable offset as UTC instead of throwing', () => {
    expect(localDay('2026-10-15T23:30:00Z', 'garbage')).toBe('2026-10-15')
    expect(localDay('2026-10-15T23:30:00Z', '-5h')).toBe('2026-10-15')
  })
})

describe('daily mappers', () => {
  it('maps HRV by civil date', () => {
    expect(mapHrv(hrv.dataPoints)).toEqual([
      { day: '2026-10-15', value: 58.4 },
      { day: '2026-10-14', value: 61.1 }
    ])
  })

  it('maps resting HR from strings and keeps only WITH_SLEEP days', () => {
    expect(mapRestingHr(restingHr.dataPoints)).toEqual([
      { day: '2026-10-15', value: 72 },
      { day: '2026-10-14', value: 74 }
    ])
  })

  it('drops zero and missing step counts', () => {
    expect(mapSteps(steps.rollupDataPoints)).toEqual([{ day: '2026-10-15', value: 10912 }])
  })
})

describe('sleep', () => {
  const sessions = mapSleepSessions(sleep.dataPoints)

  it('maps each session with stage minutes and the local end day', () => {
    expect(sessions).toHaveLength(3)
    expect(sessions[0]).toEqual({
      googleId: 'users/1234567890/dataTypes/sleep/dataPoints/111',
      day: '2026-10-15',
      startAt: new Date('2026-10-15T05:17:00Z'),
      endAt: new Date('2026-10-15T12:20:00Z'),
      mainSleep: true,
      minutesAsleep: 398,
      minutesAwake: 5,
      minutesLight: 236,
      minutesDeep: 78,
      minutesRem: 84
    })
    expect(sessions[1]).toMatchObject({ mainSleep: false, minutesLight: 38, minutesDeep: 0, minutesRem: 0 })
    expect(sessions[2]!.day).toBe('2026-10-15')
  })

  it('sums main sessions per local day into hours and ignores naps', () => {
    expect(sleepHours(sessions)).toEqual([{ day: '2026-10-15', value: 9.1 }])
  })

  it('takes the latest main-sleep end per day', () => {
    expect(mainSleepEnds(sessions).get('2026-10-15')).toEqual(new Date('2026-10-16T03:30:00Z'))
  })
})

describe('weight helpers', () => {
  it('converts pounds to whole grams', () => {
    expect(lbsToGrams(219.5)).toBe(99564)
    expect(lbsToGrams(220.2)).toBe(99881)
  })

  const app = { googleWebClientId: 'our-client' }
  const phone = {
    name: 'b',
    weight: { weightGrams: 99564 },
    dataSource: { application: { packageName: 'com.google.android.apps.fitness' } }
  }

  it('adopts only our own point carrying the grams being sent', () => {
    const ours = { name: 'a', weight: { weightGrams: 99564 }, dataSource: { application: app } }
    expect(pickOwnPoint([phone, ours], 'our-client', 99564)).toEqual({ adopt: 'a', stale: [] })
    expect(pickOwnPoint([phone], 'our-client', 99564)).toEqual({ adopt: null, stale: [] })
  })

  it('marks our own point with other grams stale instead of adopting it', () => {
    const old = { name: 'a', weight: { weightGrams: 99881 }, dataSource: { application: app } }
    expect(pickOwnPoint([phone, old], 'our-client', 99564)).toEqual({ adopt: null, stale: ['a'] })
  })

  it('keeps one matching point and marks duplicates stale', () => {
    const one = { name: 'a', weight: { weightGrams: 99564 }, dataSource: { application: app } }
    const two = { name: 'c', weight: { weightGrams: '99564' }, dataSource: { application: app } }
    expect(pickOwnPoint([one, two], 'our-client', 99564)).toEqual({ adopt: 'a', stale: ['c'] })
  })
})
