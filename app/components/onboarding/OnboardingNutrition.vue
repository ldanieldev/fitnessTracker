<script setup lang="ts">
import {
  goalProfileBody,
  mealNameErrors,
  ratioGoalError,
  ratioTotal,
  type OnboardingGoalInput
} from '~~/shared/utils/onboarding'
import { RATIO_MACROS } from '~~/shared/utils/nutritionGoals'
import { errorMessage } from '~/utils/apiError'

interface Profile {
  id: number
  isDefault: boolean
  inputMode: 'grams' | 'ratio'
  calories: number | null
  targets: Array<{ nutrient: string; amount: number; ratioPercent: number | null }>
}

interface Container {
  id: number
  name: string
  sortOrder: number
  isArchived: boolean
}

const toast = useToast()
const today = useTodayOrNow()

const profileId = ref<number | null>(null)
const goal = reactive<OnboardingGoalInput>({
  inputMode: 'grams',
  calories: null,
  protein: null,
  carbohydrate: null,
  fat: null
})
const containers = ref<Container[]>([])
const drafts = ref<Record<number, string>>({})
const removed = ref(new Set<number>())
const goalError = ref<string | undefined>()
const mealErrors = ref<Record<number, string>>({})

const modeItems = [
  { label: 'Grams', value: 'grams' },
  { label: 'Ratio (%)', value: 'ratio' }
]
const macroFields = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbohydrate', label: 'Carbs' },
  { key: 'fat', label: 'Fat' }
] as const

const remaining = computed(() => containers.value.filter((c) => !removed.value.has(c.id)).length)

defineExpose({ save })

const { status, run: load } = useStepLoad(async () => {
  const [profiles, list] = await Promise.all([
    apiFetch<Profile[]>('/api/nutrition/goal-profiles'),
    apiFetch<Container[]>('/api/nutrition/meal-containers')
  ])
  const existing = profiles.find((p) => p.isDefault) ?? null
  profileId.value = existing?.id ?? null
  goal.inputMode = existing?.inputMode ?? 'grams'
  goal.calories = existing?.calories ?? null
  for (const macro of RATIO_MACROS) {
    const target = existing?.targets.find((t) => t.nutrient === macro)
    goal[macro] = (goal.inputMode === 'ratio' ? target?.ratioPercent : target?.amount) ?? null
  }
  applyContainers(list.filter((c) => !c.isArchived).sort((a, b) => a.sortOrder - b.sortOrder))
})

function applyContainers(list: Container[]) {
  containers.value = list
  drafts.value = Object.fromEntries(list.map((c) => [c.id, c.name]))
  removed.value = new Set()
}

function forgetContainer(id: number) {
  containers.value = containers.value.filter((c) => c.id !== id)
  drafts.value = Object.fromEntries(Object.entries(drafts.value).filter(([key]) => Number(key) !== id))
  const next = new Set(removed.value)
  next.delete(id)
  removed.value = next
}

function setMode(value: string) {
  const mode = value === 'ratio' ? 'ratio' : 'grams'
  if (mode === goal.inputMode) return
  goal.inputMode = mode
  for (const macro of RATIO_MACROS) goal[macro] = null
}

function toggleRemoved(id: number) {
  const next = new Set(removed.value)
  if (!next.delete(id)) next.add(id)
  removed.value = next
}

async function save() {
  if (status.value !== 'ready') return true
  // The server's schema rejects 0 kcal (positive()), so a typed 0 is sent as no calories.
  const input = { ...goal, calories: goal.calories || null }
  const body = goalProfileBody(input)
  goalError.value = ratioGoalError(input)
  mealErrors.value = mealNameErrors(
    containers.value.map((c) => ({
      id: c.id,
      name: c.name,
      draft: drafts.value[c.id] ?? '',
      removed: removed.value.has(c.id)
    }))
  )
  if (goalError.value || Object.keys(mealErrors.value).length) return false
  try {
    if (body) {
      const query = { today: today.value }
      const saved = profileId.value
        ? await apiFetch<{ id: number }>(`/api/nutrition/goal-profiles/${profileId.value}`, {
            method: 'PUT',
            body,
            query
          })
        : await apiFetch<{ id: number }>('/api/nutrition/goal-profiles', { method: 'POST', body, query })
      profileId.value = saved.id
    }
    // Local state is updated per request, so after a mid-loop failure a retry neither skips nor repeats finished work.
    for (const c of [...containers.value]) {
      const name = drafts.value[c.id]!.trim()
      if (removed.value.has(c.id)) {
        await apiFetch(`/api/nutrition/meal-containers/${c.id}`, { method: 'DELETE' })
        forgetContainer(c.id)
      } else if (name !== c.name) {
        await apiFetch(`/api/nutrition/meal-containers/${c.id}`, { method: 'PUT', body: { name } })
        c.name = name
      }
    }
    await invalidateNutrition(NUTRITION_KEYS.profiles, NUTRITION_KEYS.containers, NUTRITION_KEYS.containersAll)
    return true
  } catch (error: unknown) {
    toast.add({
      title: 'Save failed',
      description: errorMessage(error, 'Could not save nutrition settings'),
      color: 'error'
    })
    return false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4" data-test="onboarding-step-nutrition">
    <p class="text-sm text-muted">Optional. A daily goal and the names of your meals.</p>
    <template v-if="status === 'ready'">
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Goal by" name="inputMode">
          <USelect
            :model-value="goal.inputMode"
            :items="modeItems"
            aria-label="Goal by"
            class="w-full"
            data-test="onboarding-goal-mode"
            @update:model-value="setMode"
          />
        </UFormField>
        <UFormField label="Calories" name="calories" hint="kcal">
          <AppNumberInput v-model="goal.calories" :min="1" aria-label="Calories" />
        </UFormField>
      </div>
      <UFormField
        name="macros"
        :help="goal.inputMode === 'ratio' ? `Total ${ratioTotal(goal)}%` : undefined"
        :error="goalError"
        data-test="onboarding-macros"
      >
        <div class="grid grid-cols-3 gap-3">
          <UFormField
            v-for="macro in macroFields"
            :key="macro.key"
            :label="macro.label"
            :name="macro.key"
            :hint="goal.inputMode === 'ratio' ? '%' : 'g'"
          >
            <AppNumberInput
              v-model="goal[macro.key]"
              :min="0"
              :max="goal.inputMode === 'ratio' ? 100 : undefined"
              :aria-label="macro.label"
            />
          </UFormField>
        </div>
      </UFormField>

      <div class="flex flex-col gap-2">
        <p class="text-sm font-medium text-highlighted">Meals</p>
        <div v-for="(container, index) in containers" :key="container.id" class="flex items-start gap-2">
          <UFormField
            :name="`meal-${container.id}`"
            :error="mealErrors[container.id]"
            class="flex-1"
            data-test="onboarding-meal-row"
          >
            <UInput
              v-model="drafts[container.id]"
              :aria-label="`Meal ${index + 1} name`"
              :disabled="removed.has(container.id)"
              :class="['w-full', removed.has(container.id) && 'line-through']"
              data-test="onboarding-meal-name"
            />
          </UFormField>
          <UButton
            v-if="removed.has(container.id)"
            label="Undo"
            size="sm"
            variant="ghost"
            color="neutral"
            :aria-label="`Undo removing ${container.name}`"
            @click="toggleRemoved(container.id)"
          />
          <UButton
            v-else
            icon="i-lucide-trash-2"
            size="sm"
            variant="ghost"
            color="neutral"
            :aria-label="`Remove ${container.name}`"
            :disabled="remaining <= 1"
            @click="toggleRemoved(container.id)"
          />
        </div>
      </div>
    </template>
    <OnboardingLoadFailed
      v-else-if="status === 'failed'"
      message="Couldn't load your nutrition settings."
      test-id="onboarding-nutrition-retry"
      @retry="load"
    />
  </div>
</template>
