import { describe, expect, it } from 'vitest'
import {
  cardioMetricDisplay, clockLabel, metersToMiles, milesLabel, milesToMeters, paceFromSecondsPerMile, parseClock,
  secondsPerMile
} from '../../shared/utils/cardioUnits'

describe('miles', () => {
  it('converts metres to miles to the hundredth and back without drift', () => {
    expect(metersToMiles(5000)).toBe(3.11)
    expect(metersToMiles(1609.344)).toBe(1)
    expect(metersToMiles(400)).toBe(0.25)
    expect(milesToMeters(3.1)).toBe(4988.97)
    expect(metersToMiles(milesToMeters(3.1))).toBe(3.1)
    expect(metersToMiles(milesToMeters(26.22))).toBe(26.22)
  })

  it('does not round-trip an unedited metre value', () => {
    expect(milesToMeters(metersToMiles(100))).not.toBe(100)
  })

  it('labels a distance in miles', () => {
    expect(milesLabel(5000)).toBe('3.11 mi')
    expect(milesLabel(1609.344)).toBe('1 mi')
  })
})

describe('clock', () => {
  it('labels seconds as m:ss under an hour and h:mm:ss beyond', () => {
    expect(clockLabel(1530)).toBe('25:30')
    expect(clockLabel(45)).toBe('0:45')
    expect(clockLabel(3930)).toBe('1:05:30')
    expect(clockLabel(44.6)).toBe('0:45')
  })

  it('reads colon-separated clocks', () => {
    expect(parseClock('25:30')).toBe(1530)
    expect(parseClock('0:45')).toBe(45)
    expect(parseClock('1:05:30')).toBe(3930)
    expect(parseClock(' 25:30 ')).toBe(1530)
  })

  it('reads a half-typed clock as the parts so far', () => {
    expect(parseClock('25:')).toBe(1500)
    expect(parseClock('1:05:')).toBe(3900)
    expect(parseClock('25:3')).toBe(1503)
  })

  it('reads bare digits right to left like a keypad', () => {
    expect(parseClock('45')).toBe(45)
    expect(parseClock('130')).toBe(90)
    expect(parseClock('2530')).toBe(1530)
    expect(parseClock('10530')).toBe(3930)
  })

  it('rejects anything else', () => {
    expect(parseClock('')).toBeNull()
    expect(parseClock('1:75')).toBeNull()
    expect(parseClock('1:00:75')).toBeNull()
    expect(parseClock('2.5')).toBeNull()
    expect(parseClock(':30')).toBeNull()
    expect(parseClock('abc')).toBeNull()
  })

  it('rejects out-of-range parts in bare digits', () => {
    expect(parseClock('99')).toBeNull()
    expect(parseClock('175')).toBeNull()
    expect(parseClock('10575')).toBeNull()
    expect(parseClock('99999')).toBeNull()
    expect(parseClock('130')).toBe(90)
  })

  it('caps the clock at 100 hours and rejects empty middle parts', () => {
    expect(parseClock('100:00:00')).toBe(360000)
    expect(parseClock('100:00:01')).toBeNull()
    expect(parseClock('1::')).toBeNull()
    expect(parseClock('1::5')).toBeNull()
  })

  it('shows unknown for values that are not a measure', () => {
    for (const bad of [NaN, -1, Infinity]) {
      expect(clockLabel(bad)).toBe('—')
      expect(milesLabel(bad)).toBe('—')
    }
    expect(cardioMetricDisplay('pace')!.format(cardioMetricDisplay('pace')!.toDisplay(0))).toBe('—')
    expect(cardioMetricDisplay('distance')!.format(NaN)).toBe('—')
    expect(cardioMetricDisplay('duration')!.format(-5)).toBe('—')
  })
})

describe('pace', () => {
  it('converts between metres per second and seconds per mile', () => {
    expect(secondsPerMile(5000 / 1500)).toBeCloseTo(482.8032, 4)
    expect(paceFromSecondsPerMile(480)).toBeCloseTo(3.3528, 4)
  })
})

describe('cardioMetricDisplay', () => {
  it('shows distance in miles', () => {
    const display = cardioMetricDisplay('distance')!
    expect(display.unit).toBe('mi')
    expect(display.label).toBe('mi')
    expect(display.format(display.toDisplay(8046.72))).toBe('5')
    expect(display.format(2.5)).toBe('2.5')
  })

  it('shows duration as a clock over a minutes axis', () => {
    const display = cardioMetricDisplay('duration')!
    expect(display.unit).toBe('')
    expect(display.label).toBe('m:ss')
    expect(display.toDisplay(1530)).toBe(25.5)
    expect(display.format(25.5)).toBe('25:30')
  })

  it('shows pace as minutes per mile', () => {
    const display = cardioMetricDisplay('pace')!
    expect(display.unit).toBe('/mi')
    expect(display.label).toBe('min/mi')
    expect(display.format(display.toDisplay(5000 / 1500))).toBe('8:03')
  })

  it('leaves the weight metrics alone', () => {
    expect(cardioMetricDisplay('max_weight')).toBeNull()
    expect(cardioMetricDisplay('total_reps')).toBeNull()
  })
})
