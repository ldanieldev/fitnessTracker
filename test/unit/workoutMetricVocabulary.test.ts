import { describe, expect, it } from 'vitest'
import { GRAPH_METRIC_VALUES } from '../../shared/types/workout'

describe('graph metric vocabulary', () => {
  it('lists every metric the design names, once', () => {
    expect([...GRAPH_METRIC_VALUES]).toEqual([
      'e1rm',
      'max_weight',
      'volume',
      'total_reps',
      'weight_at_reps',
      'distance',
      'duration',
      'pace'
    ])
    expect(new Set(GRAPH_METRIC_VALUES).size).toBe(GRAPH_METRIC_VALUES.length)
  })
})
