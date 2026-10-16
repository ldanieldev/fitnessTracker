import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { MeasurementEntry, MeasurementType, MetricOverview } from '../../shared/types/body'
import { todayDate } from '../../shared/utils/nutritionSummary'

// UTC+14 puts the browser on another calendar day than the server most hours, reproducing prod's UTC container.
test.use({ timezoneId: 'Pacific/Kiritimati' })

async function bodyweight(page: Parameters<typeof apiFetch>[0]) {
  return (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'bodyweight')!
}

test('overview windows its sparkline on the client\'s today and refuses a malformed one', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = await bodyweight(page)
  for (const day of ['2030-01-05', '2030-01-10']) {
    const res = await apiFetch(page, 'POST', '/api/body/entries', {
      typeId: weight.id,
      value: 200,
      measuredAt: `${day}T08:00:00.000Z`,
      measuredOn: day
    })
    expect(res.ok).toBe(true)
  }

  const sparkDates = async (today: string) =>
    (await apiFetch<MetricOverview[]>(page, 'GET', `/api/body/overview?today=${today}`)).json
      .find((m) => m.type.key === 'bodyweight')!
      .sparkline.map((p) => p.date)
  expect(await sparkDates('2030-01-10')).toEqual(['2030-01-05', '2030-01-10'])
  expect(await sparkDates('2030-01-05')).toEqual(['2030-01-05'])

  const bad = await apiFetch(page, 'GET', '/api/body/overview?today=2030-02-30')
  expect(bad.status).toBe(400)
})

test('the body hub asks for the overview with the browser\'s date', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const browserToday = await page.evaluate(() => new Date().toLocaleDateString('en-CA'))
  const asked: string[] = []
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.pathname === '/api/body/overview') asked.push(url.searchParams.get('today') ?? '')
  })

  await goto('/body', { waitUntil: 'hydration' })
  await page.waitForLoadState('networkidle')
  // SSR uses the server's date (todayDate() here, same machine); the browser refetches only when its date differs.
  if (browserToday !== todayDate()) expect(asked).toContain(browserToday)
  expect(asked.every((day) => day === browserToday)).toBe(true)
})

test('a reading\'s time is rendered in the browser\'s timezone, never by the server', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = await bodyweight(page)
  const now = await page.evaluate(() => ({
    iso: new Date().toISOString(),
    clock: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }))
  // The server's list ends at its own date, so a browser-dated reading would be missing from SSR and pass vacuously.
  const entry = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId: weight.id,
    value: 200,
    measuredAt: now.iso,
    measuredOn: todayDate()
  })
  expect(entry.ok).toBe(true)

  const ssr = await page.evaluate((url) => fetch(url).then((r) => r.text()), `/body/${weight.id}`)
  const start = ssr.indexOf(`data-test="entry-row-${entry.json.id}"`)
  expect(start).toBeGreaterThan(-1)
  const row = ssr.slice(start)
  expect(row.slice(0, row.indexOf('</button>'))).not.toMatch(/\d{1,2}:\d{2} [AP]M/)

  await goto(`/body/${weight.id}`, { waitUntil: 'hydration' })
  await expect(page.locator(`[data-test="entry-row-${entry.json.id}"]`)).toContainText(now.clock)
})

test('a meal\'s time derived from its entries is rendered in the browser\'s timezone, never by the server', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const day = todayDate()
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Timezone toast',
    servings: [{ kind: 'named', label: 'slice', quantity: 1, nutrients: { protein: 3 } }]
  })
  const logged = await apiFetch(page, 'POST', `/api/nutrition/diary/${day}/entries`, [
    { entryType: 'food', foodId: food.json.id, containerId: containers.json[0]!.id, quantity: 1, unitLabel: 'slice' }
  ])
  expect(logged.ok).toBe(true)
  const diary = await apiFetch<{ entries: Array<{ loggedAt: string }> }>(page, 'GET', `/api/nutrition/diary/${day}`)
  const loggedAt = diary.json.entries[0]!.loggedAt
  const clock = await page.evaluate((iso) => {
    const at = new Date(iso)
    return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  }, loggedAt)

  const ssr = await page.evaluate((url) => fetch(url).then((r) => r.text()), `/nutrition/diary/${day}`)
  expect(ssr).toContain('Timezone toast')
  expect(ssr).not.toContain('data-test="container-time"')

  await goto(`/nutrition/diary/${day}`, { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="container-time"]').first()).toHaveText(clock)
})
