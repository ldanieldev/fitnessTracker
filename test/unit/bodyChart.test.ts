import { describe, expect, it } from 'vitest'

describe('bodyChart', () => {
  it('snaps a range to nice ticks and expands outward, never to zero', async () => {
    const { niceTicks } = await import('../../shared/utils/bodyChart')
    expect(niceTicks(183, 204)).toEqual({ min: 180, max: 205, ticks: [180, 185, 190, 195, 200, 205] })
    const r = niceTicks(196.3, 203.4)
    expect(r.min).toBeLessThanOrEqual(196.3)
    expect(r.max).toBeGreaterThanOrEqual(203.4)
    expect(r.min).toBeGreaterThan(0)
    for (const t of r.ticks) expect(t % 2).toBe(0)
    expect(niceTicks(200, 200)).toEqual({ min: 199, max: 201, ticks: [199, 199.5, 200, 200.5, 201] })
  })

  it('splits a series at gaps and emits one M per segment', async () => {
    const { segmentByGap, pathFrom } = await import('../../shared/utils/bodyChart')
    const points = [
      { date: '2017-12-10', value: 182.4 },
      { date: '2022-02-03', value: 202 },
      { date: '2022-02-08', value: 200 }
    ]
    const segments = segmentByGap(points, 10)
    expect(segments.map((s) => s.length)).toEqual([1, 2])
    const path = pathFrom(segments.map((s) => s.map((p, i) => ({ x: i * 10, y: p.value }))))
    expect(path.match(/M/g)).toHaveLength(2)
  })

  it('builds a model whose y domain is data-driven and ignores the goal, with date-linear x', async () => {
    const { buildChartModel } = await import('../../shared/utils/bodyChart')
    const points = [
      { date: '2026-03-01', value: 200 },
      { date: '2026-03-02', value: 199 },
      { date: '2026-03-10', value: 198 }
    ]
    const m = buildChartModel({ points, trend: [], goal: 185, from: '2026-03-01', to: '2026-03-10', width: 320, height: 200, gapDays: 10 })
    expect(m.y.domain[0]).toBeGreaterThan(185)
    expect(m.y.domain[1]).toBeLessThan(210)
    expect(m.goalY).toBe(m.plot.bottom)
    expect(m.dots).toHaveLength(3)
    // 1 day apart vs 8 days apart on a linear date axis
    const gap1 = m.dots[1]!.x - m.dots[0]!.x
    const gap8 = m.dots[2]!.x - m.dots[1]!.x
    expect(gap8 / gap1).toBeCloseTo(8, 5)
    expect(m.dots[0]!.x).toBe(m.plot.left)
    expect(m.dots[2]!.x).toBe(m.plot.right)
    expect(m.areaPath.endsWith('Z')).toBe(true)
  })

  it('keeps an in-range goal on its own row and pins an out-of-range goal to the nearest edge', async () => {
    const { buildChartModel } = await import('../../shared/utils/bodyChart')
    const points = [
      { date: '2026-03-01', value: 200 },
      { date: '2026-03-10', value: 198 }
    ]
    const base = { points, trend: [], from: '2026-03-01', to: '2026-03-10', width: 320, height: 200, gapDays: 10 }
    const inside = buildChartModel({ ...base, goal: 199 })
    expect(inside.goalY).toBe(inside.y(199))
    const above = buildChartModel({ ...base, goal: 260 })
    expect(above.goalY).toBe(above.plot.top)
    expect(above.y.domain[1]).toBeLessThan(260)
  })

  it('spreads date ticks from first to last day without duplicates', async () => {
    const { dateTicks } = await import('../../shared/utils/bodyChart')
    expect(dateTicks('2026-03-01', '2026-03-31', 3)).toEqual(['2026-03-01', '2026-03-16', '2026-03-31'])
    expect(dateTicks('2026-03-01', '2026-03-01', 3)).toEqual(['2026-03-01'])
  })

  it('finds the nearest dot on x', async () => {
    const { nearestPoint } = await import('../../shared/utils/bodyChart')
    const dots = [{ x: 10 }, { x: 50 }, { x: 90 }]
    expect(nearestPoint(dots, 55)).toBe(dots[1])
    expect(nearestPoint([], 5)).toBeNull()
  })
})
