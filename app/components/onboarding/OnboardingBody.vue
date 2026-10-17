<script setup lang="ts">
import type { GoalOverview, MeasurementEntry, MeasurementGoal, MeasurementType } from '~~/shared/types/body'
import { todayDate } from '~~/shared/utils/nutritionSummary'
import { errorMessage } from '~/utils/apiError'

const toast = useToast()
const today = todayDate()

const bodyweight = ref<MeasurementType | null>(null)
const todayEntry = ref<MeasurementEntry | null>(null)
const latest = ref<MeasurementEntry | null>(null)
const savedGoal = ref<MeasurementGoal | null>(null)
const state = reactive<{ weight: number | null; goal: number | null; targetDate: string }>({
  weight: null,
  goal: null,
  targetDate: ''
})
const weightError = ref<string | undefined>()

const { status, run: load } = useStepLoad(async () => {
  const types = await apiFetch<MeasurementType[]>('/api/body/types')
  const type = types.find((t) => t.key === 'bodyweight') ?? null
  if (type) {
    const [entries, goals] = await Promise.all([
      apiFetch<MeasurementEntry[]>(`/api/body/types/${type.id}/entries`, { query: { to: today, limit: 1 } }),
      apiFetch<GoalOverview[]>('/api/body/goals')
    ])
    latest.value = entries[0] ?? null
    todayEntry.value = latest.value?.measuredOn === today ? latest.value : null
    state.weight = todayEntry.value?.value ?? null
    savedGoal.value = goals.find((g) => g.type.id === type.id)?.goal ?? null
    state.goal = savedGoal.value?.targetValue ?? null
    state.targetDate = savedGoal.value?.targetDate ?? ''
  }
  bodyweight.value = type
})

const lastWeight = computed(() => (!todayEntry.value && latest.value ? `Last: ${latest.value.value} lb` : ''))

defineExpose({ save })

async function save() {
  weightError.value = undefined
  const type = bodyweight.value
  if (status.value !== 'ready' || !type) return true
  const targetDate = state.targetDate || null
  const goalChanged =
    state.goal != null &&
    (state.goal !== savedGoal.value?.targetValue || targetDate !== (savedGoal.value?.targetDate ?? null))
  if (state.weight == null && goalChanged && !latest.value) {
    weightError.value = 'Enter your current weight first'
    return false
  }
  try {
    let wroteToday = false
    if (state.weight != null && state.weight !== todayEntry.value?.value) {
      todayEntry.value = todayEntry.value
        ? await apiFetch<MeasurementEntry>(`/api/body/entries/${todayEntry.value.id}`, {
            method: 'PATCH',
            body: { value: state.weight }
          })
        : await apiFetch<MeasurementEntry>('/api/body/entries', {
            method: 'POST',
            body: { typeId: type.id, value: state.weight, measuredOn: today }
          })
      latest.value = todayEntry.value
      wroteToday = true
    }
    // A goal started from today's reading follows a corrected weight; an older start stays put.
    if (state.goal == null && savedGoal.value) {
      await apiFetch(`/api/body/types/${type.id}/goal`, { method: 'DELETE' })
      savedGoal.value = null
    } else if (state.goal != null && (goalChanged || (wroteToday && savedGoal.value?.startDate === today))) {
      savedGoal.value = await apiFetch<MeasurementGoal>(`/api/body/types/${type.id}/goal`, {
        method: 'PUT',
        body: { targetValue: state.goal, targetDate }
      })
    }
    return true
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save your weight'), color: 'error' })
    return false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4" data-test="onboarding-step-body">
    <p class="text-sm text-muted">Optional. Your starting point for the weight trend.</p>
    <template v-if="status === 'ready' && bodyweight">
      <UFormField label="Current weight" name="weight" hint="lb" :error="weightError">
        <AppNumberInput
          v-model="state.weight"
          :min="0"
          :step="0.1"
          :placeholder="lastWeight"
          aria-label="Current weight"
        />
      </UFormField>
      <UFormField label="Goal weight" name="goal" hint="lb, optional">
        <AppNumberInput v-model="state.goal" :min="0" :step="0.1" aria-label="Goal weight" />
      </UFormField>
      <UFormField label="Target date" name="targetDate" hint="optional">
        <UInput v-model="state.targetDate" type="date" :min="today" aria-label="Target date" class="w-full" />
      </UFormField>
    </template>
    <p v-else-if="status === 'ready'" class="text-sm text-muted">Weight tracking isn't available right now.</p>
    <OnboardingLoadFailed
      v-else-if="status === 'failed'"
      message="Couldn't load your weight."
      test-id="onboarding-body-retry"
      @retry="load"
    />
  </div>
</template>
