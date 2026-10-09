import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from '../helpers'
import type { Routine } from '../../../shared/types/routine'

test.use({ viewport: { width: 360, height: 740 } })

test('phone: build a program, start it now, see it on log, history and dashboard, pause and resume', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routineName = uniquePrefix('Phone UL ')
  const r = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: routineName })).json
  await apiFetch(page, 'POST', `/api/workouts/routines/${r.id}/days`, { name: 'Upper A' })

  await goto('/workouts/programs', { waitUntil: 'hydration' })
  await page.locator('[data-test="program-new"]').click()
  const programName = uniquePrefix('Phone BLS ')
  await page.locator('[data-test="program-new-name"]').fill(programName)
  await page.locator('[data-test="program-new-save"]').click()
  await expect(page).toHaveURL(/\/workouts\/programs\/\d+$/)

  await page.locator('[data-test="phase-add"]').click()
  await page.locator('[data-test="phase-name"]').fill('Hypertrophy')
  await page.locator('[data-test="phase-save"]').click()
  await expect(page.locator('[data-test^="phase-card-"]')).toHaveCount(1)
  await expect(page.locator('[data-test="program-total"]')).toHaveText('4 weeks')

  await page.locator('[data-test="program-start"]').click()
  await page.locator('[data-test="when-now"]').click()
  await expect(page).toHaveURL(/\/workouts\/programs$/)
  await expect(page.locator('[data-test="enrollment-line"]')).toHaveText('Week 1 of 4 · Hypertrophy')

  await goto('/workouts/log', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="program-status-line"]')).toContainText(programName)
  await expect(page.locator('[data-test="start-routine-next-name"]')).toHaveText('Upper A')
  await page.locator('[data-test="start-routine-next"]').click()
  await page.locator('[data-test="session-finish"]').click()

  await goto('/workouts/sessions?view=list', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test^="session-program-"]').first()).toHaveText('P1 · W1')

  await goto('/', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="dashboard-program"]')).toContainText(programName)

  await goto('/workouts/programs', { waitUntil: 'hydration' })
  await page.locator('[data-test="enrollment-pause"]').click()
  await expect(page.locator('[data-test="enrollment-line"]')).toHaveText('Paused at week 1 of 4')
  await page.locator('[data-test="enrollment-resume"]').click()
  await page.locator('[data-test="when-now"]').click()
  await expect(page.locator('[data-test="enrollment-line"]')).toHaveText('Week 1 of 4 · Hypertrophy')
})

test('phone: starting from the editor while another program runs asks to replace it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const names = [uniquePrefix('Phone Run A '), uniquePrefix('Phone Run B ')]
  const ids: number[] = []
  for (const name of names) {
    const p = (await apiFetch<{ id: number }>(page, 'POST', '/api/workouts/programs', { name })).json
    await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/phases`, { name: 'Main', weeks: 2 })
    ids.push(p.id)
  }
  await apiFetch(page, 'POST', `/api/workouts/programs/${ids[0]}/enroll`, { when: 'now' })

  await goto(`/workouts/programs/${ids[1]}`, { waitUntil: 'hydration' })
  await page.locator('[data-test="program-start"]').click()
  await page.locator('[data-test="when-now"]').click()
  await page.locator('[data-test="program-replace-confirm"]').click()
  await expect(page).toHaveURL(/\/workouts\/programs$/)
  await expect(page.locator('[data-test="enrollment-card"], [data-test="enrollment-line"]').first()).toBeVisible()
  await expect(page.getByText(names[1]!).first()).toBeVisible()
})

test('phone: editor fields show the saved value again after a blank name or a failed save', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const programName = uniquePrefix('Phone Reset ')
  const program = (await apiFetch<{ id: number }>(page, 'POST', '/api/workouts/programs', { name: programName })).json
  await goto(`/workouts/programs/${program.id}`, { waitUntil: 'hydration' })

  const name = page.locator('[data-test="program-name"]')
  const description = page.locator('[data-test="program-description"]')
  await name.fill('')
  await name.blur()
  await expect(name).toHaveValue(programName)

  await page.route(`**/api/workouts/programs/${program.id}`, (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
      : route.continue()
  )
  await name.fill('Renamed')
  await name.blur()
  await expect(page.getByText('Couldn\'t save program', { exact: true })).toBeVisible()
  await expect(name).toHaveValue(programName)
  await description.fill('Draft text')
  await description.blur()
  await expect(description).toHaveValue('')
})
