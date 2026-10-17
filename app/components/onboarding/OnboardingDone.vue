<script setup lang="ts">
import type { GoalOverview, MeasurementEntry, MeasurementType } from '~~/shared/types/body'
import { splitHeight } from '~~/shared/utils/height'
import { todayDate } from '~~/shared/utils/nutritionSummary'
import { RATIO_MACROS } from '~~/shared/utils/nutritionGoals'

interface Profile {
  isDefault: boolean
  inputMode: 'grams' | 'ratio'
  calories: number | null
  targets: Array<{ nutrient: string; amount: number; ratioPercent: number | null }>
}

const { user } = useUserSession()
const modules = useModules()
const { defaultRestSeconds, plateSizes, workoutsPerWeek } = useWorkoutPrefs()

const macroLabels = { protein: 'Protein', carbohydrate: 'Carbs', fat: 'Fat' }

const profileLines = ref<string[]>([])
const bodyLines = ref<string[]>([])
const nutritionLines = ref<string[]>([])

async function loadProfile() {
  const row = await apiFetch<{ heightIn: string | null }>(`/api/users/${user.value!.id}`)
  const height = splitHeight(row.heightIn == null ? null : Number(row.heightIn))
  const sex = user.value?.sex === 'm' ? 'Male' : user.value?.sex === 'f' ? 'Female' : null
  profileLines.value = [
    // OAuth signups are created with age 0, which is a placeholder, not an answer.
    user.value?.age ? `Age ${user.value.age}` : null,
    sex,
    height.feet != null ? `Height ${height.feet}′ ${height.inches}″` : null
  ].filter((line): line is string => line !== null)
}

async function loadBody() {
  const types = await apiFetch<MeasurementType[]>('/api/body/types')
  const type = types.find((t) => t.key === 'bodyweight')
  if (!type) return
  const [entries, goals] = await Promise.all([
    apiFetch<MeasurementEntry[]>(`/api/body/types/${type.id}/entries`, { query: { to: todayDate(), limit: 1 } }),
    apiFetch<GoalOverview[]>('/api/body/goals')
  ])
  const latest = entries[0]
  const goal = goals.find((g) => g.type.id === type.id)?.goal
  bodyLines.value = [
    latest ? `Weight ${latest.value} lb` : null,
    goal ? `Goal ${goal.targetValue} lb${goal.targetDate ? ` by ${goal.targetDate}` : ''}` : null
  ].filter((line): line is string => line !== null)
}

async function loadNutrition() {
  const profiles = await apiFetch<Profile[]>('/api/nutrition/goal-profiles')
  const profile = profiles.find((p) => p.isDefault)
  if (!profile) return
  const macros = RATIO_MACROS.flatMap((macro) => {
    const target = profile.targets.find((t) => t.nutrient === macro)
    if (!target) return []
    const value = profile.inputMode === 'ratio' ? `${target.ratioPercent}%` : `${Math.round(target.amount)} g`
    return [`${macroLabels[macro]} ${value}`]
  })
  nutritionLines.value = [profile.calories != null ? `${profile.calories} kcal` : null, ...macros].filter(
    (line): line is string => line !== null
  )
}

const { status, run: load } = useStepLoad(async () => {
  await Promise.all([
    loadProfile(),
    modules.body.value ? loadBody() : null,
    modules.nutrition.value ? loadNutrition() : null
  ])
})

const sections = computed(() =>
  [
    { key: 'profile', title: 'About you', on: true, lines: profileLines.value },
    { key: 'body', title: 'Body', on: modules.body.value, lines: bodyLines.value },
    { key: 'nutrition', title: 'Nutrition goal', on: modules.nutrition.value, lines: nutritionLines.value },
    {
      key: 'workouts',
      title: 'Workouts',
      on: modules.workouts.value,
      lines: [
        `${workoutsPerWeek.value} per week`,
        `Rest ${defaultRestSeconds.value} s`,
        `${plateSizes.value.length} plate sizes`
      ]
    }
  ].filter((section) => section.on)
)
</script>

<template>
  <div class="flex flex-col gap-4" data-test="onboarding-step-done">
    <p class="text-default">You're set. Everything here can be changed later in Settings.</p>
    <dl v-if="status === 'ready'" class="flex flex-col gap-3 text-sm">
      <div v-for="section in sections" :key="section.key" :data-test="`onboarding-summary-${section.key}`">
        <dt class="font-medium text-highlighted">{{ section.title }}</dt>
        <dd v-if="section.lines.length" class="text-muted">{{ section.lines.join(' · ') }}</dd>
        <dd v-else class="text-dimmed">Nothing set yet — change it any time in Settings</dd>
      </div>
    </dl>
    <OnboardingLoadFailed
      v-else-if="status === 'failed'"
      message="Couldn't load your summary."
      test-id="onboarding-done-retry"
      @retry="load"
    />
  </div>
</template>
