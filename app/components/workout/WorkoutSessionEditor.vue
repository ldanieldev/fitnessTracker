<script setup lang="ts">
import type { SetMeasures, WorkoutEntry, WorkoutSession } from '~~/shared/types/workout'
import type { SetFlow } from '~~/shared/utils/supersets'
import { moveWithGroups, nextAfterSet, supersetIndex, supersetLabel } from '~~/shared/utils/supersets'
import { errorMessage } from '~/utils/apiError'
import WorkoutSupersetSheet from '~/components/workout/WorkoutSupersetSheet.vue'

type SetValues = SetMeasures & { comment?: string }
type SetResponse = { session: WorkoutSession }

const props = defineProps<{
  session: WorkoutSession
  plateButton?: boolean
  presetWeights?: Record<number, { weight: number; seq: number }>
}>()

const emit = defineEmits<{
  'update:session': [session: WorkoutSession]
  setLogged: [entryId: number, flow: SetFlow]
  openPlates: [entryId: number, weight: number | null]
  delete: []
}>()

const fail = useFailToast()
const pickerOpen = ref(false)

async function applySession(action: () => Promise<WorkoutSession>, title: string, fallback: string) {
  try {
    emit('update:session', await action())
  } catch (err: unknown) {
    fail(title, err, fallback)
  }
}

function patchSession(body: Record<string, unknown>, title: string, fallback: string) {
  return applySession(
    () => apiFetch<WorkoutSession>(`/api/workouts/sessions/${props.session.id}`, { method: 'PATCH', body }),
    title,
    fallback
  )
}

const rename = (name: string | null) =>
  patchSession({ name }, 'Couldn\'t rename workout', 'Could not rename this workout')
const comment = (notes: string | null) =>
  patchSession({ notes }, 'Couldn\'t save comment', 'Could not save this comment')
const changeTimes = (times: { startedAt: string; endedAt: string | null; performedOn: string }) =>
  patchSession(times, 'Couldn\'t change date and time', 'Could not change the date and time')

function addExercise(exerciseId: number) {
  return applySession(
    () =>
      apiFetch<WorkoutSession>(`/api/workouts/sessions/${props.session.id}/entries`, {
        method: 'POST',
        body: { exerciseId }
      }),
    'Couldn\'t add exercise',
    'Could not add this exercise'
  )
}

function moveEntry(entry: WorkoutEntry, direction: -1 | 1) {
  return applySession(
    () =>
      apiFetch<WorkoutSession>(`/api/workouts/entries/${entry.id}`, {
        method: 'PATCH',
        body: { sortOrder: entry.sortOrder + direction }
      }),
    'Couldn\'t reorder exercise',
    'Could not reorder this exercise'
  )
}

const collapsed = reactive<Record<number, boolean>>({})
const orderItems = computed(() =>
  props.session.entries.map((entry) => ({ id: entry.id, supersetGroup: entry.supersetGroup }))
)
const canMove = (id: number, delta: -1 | 1) => moveWithGroups(orderItems.value, id, delta) !== orderItems.value

const supersetOpen = ref(false)
const supersetAnchor = ref<WorkoutEntry | null>(null)
const supersetOptions = computed(() =>
  props.session.entries
    .filter((entry) => entry.id !== supersetAnchor.value?.id)
    .map((entry) => ({ id: entry.id, name: entry.exerciseName }))
)

function openSuperset(entry: WorkoutEntry) {
  supersetAnchor.value = entry
  supersetOpen.value = true
}

function groupWith(ids: number[]) {
  const anchor = supersetAnchor.value
  if (!anchor) return
  return applySession(
    () =>
      apiFetch<WorkoutSession>(`/api/workouts/sessions/${props.session.id}/group`, {
        method: 'POST',
        body: { entryIds: [anchor.id, ...ids] }
      }),
    'Couldn\'t make superset',
    'Could not make this superset'
  )
}

function ungroup(entryId: number) {
  return applySession(
    () =>
      apiFetch<WorkoutSession>(`/api/workouts/entries/${entryId}`, { method: 'PATCH', body: { supersetGroup: null } }),
    'Couldn\'t remove from superset',
    'Could not remove this exercise from the superset'
  )
}

function removeEntry(entryId: number) {
  return applySession(
    () => apiFetch<WorkoutSession>(`/api/workouts/entries/${entryId}`, { method: 'DELETE' }),
    'Couldn\'t remove exercise',
    'Could not remove this exercise'
  )
}

function removeSet(setId: number) {
  return applySession(
    () => apiFetch<WorkoutSession>(`/api/workouts/sets/${setId}`, { method: 'DELETE' }),
    'Couldn\'t remove set',
    'Could not remove this set'
  )
}

const saveErrors = reactive(new Map<string, string>())
const retries = new Map<string, () => Promise<SetResponse>>()

function saveKey(entryId: number, setId: number | null) {
  return `${entryId}:${setId ?? 'new'}`
}

function entryErrors(entryId: number): Record<string, string> {
  const prefix = `${entryId}:`
  const errors: Record<string, string> = {}
  for (const [key, message] of saveErrors) {
    if (key.startsWith(prefix)) errors[key.slice(prefix.length)] = message
  }
  return errors
}

function forgetSave(key: string) {
  saveErrors.delete(key)
  retries.delete(key)
}

let lastSessionId: number | null = null
watch(
  () => props.session,
  (value) => {
    if (value.id !== lastSessionId) {
      lastSessionId = value.id
      saveErrors.clear()
      retries.clear()
      return
    }
    for (const key of [...saveErrors.keys()]) {
      const [entryPart, setPart] = key.split(':')
      const entry = value.entries.find((candidate) => String(candidate.id) === entryPart)
      if (!entry || (setPart !== 'new' && !entry.sets.some((set) => String(set.id) === setPart))) forgetSave(key)
    }
  },
  { immediate: true }
)

async function saveSet(
  entryId: number,
  setId: number | null,
  action: () => Promise<SetResponse>
): Promise<WorkoutSession | null> {
  const key = saveKey(entryId, setId)
  saveErrors.delete(key)
  try {
    const { session } = await action()
    emit('update:session', session)
    forgetSave(key)
    return session
  } catch (err: unknown) {
    retries.set(key, action)
    saveErrors.set(key, errorMessage(err, 'Could not save this set'))
    return null
  }
}

function retrySave(entryId: number, setId: number | null) {
  const action = retries.get(saveKey(entryId, setId))
  if (action) return saveSet(entryId, setId, action)
}

async function addSet(entryId: number, values: SetValues) {
  const session = await saveSet(entryId, null, () =>
    apiFetch<SetResponse>(`/api/workouts/entries/${entryId}/sets`, { method: 'POST', body: values })
  )
  if (!session) return
  const flow = nextAfterSet(
    session.entries.map((entry) => ({
      id: entry.id,
      supersetGroup: entry.supersetGroup,
      setCount: entry.sets.length,
      targetSets: entry.target?.sets ?? null
    })),
    entryId
  )
  if (flow.open !== null && flow.open !== entryId) {
    collapsed[entryId] = true
    collapsed[flow.open] = false
    await nextTick()
    document
      .querySelector(`[data-test="entry-card-${flow.open}"]`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  emit('setLogged', entryId, flow)
}

function editSet(entryId: number, setId: number, values: SetValues) {
  return saveSet(entryId, setId, () =>
    apiFetch<SetResponse>(`/api/workouts/sets/${setId}`, { method: 'PATCH', body: values })
  )
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <WorkoutSessionHeader
      :session="session"
      @rename="rename"
      @comment="comment"
      @change-times="changeTimes"
      @delete="emit('delete')"
    />

    <WorkoutExerciseCard
      v-for="entry in session.entries"
      :key="entry.id"
      v-model:collapsed="collapsed[entry.id]"
      :entry="entry"
      :deload="session.deload"
      :is-first="!canMove(entry.id, -1)"
      :is-last="!canMove(entry.id, 1)"
      :plate-button="plateButton"
      :preset-weight="presetWeights?.[entry.id] ?? null"
      :save-errors="entryErrors(entry.id)"
      :superset-label="supersetLabel(orderItems, entry.id)"
      :superset-border-class="entry.supersetGroup !== null ? supersetBorder(supersetIndex(orderItems, entry.id)) : null"
      :can-group="session.entries.length > 1"
      @superset="openSuperset(entry)"
      @ungroup="ungroup(entry.id)"
      @add-set="(values) => addSet(entry.id, values)"
      @edit-set="(setId, values) => editSet(entry.id, setId, values)"
      @remove-set="(setId) => removeSet(setId)"
      @move="(direction) => moveEntry(entry, direction)"
      @remove="removeEntry(entry.id)"
      @retry-save="(setId) => retrySave(entry.id, setId)"
      @plates="(weight) => emit('openPlates', entry.id, weight)"
    />

    <p v-if="!session.entries.length" class="text-sm text-dimmed">Add an exercise to start logging sets.</p>

    <button
      type="button"
      class="
        flex min-h-10 w-full items-center gap-2 rounded-lg border border-default bg-default px-3 text-left text-sm
        text-dimmed hover:bg-elevated
      "
      data-test="entry-add"
      @click="pickerOpen = true"
    >
      <UIcon name="i-lucide-plus" class="size-4 shrink-0" />
      <span>Search exercises to add…</span>
    </button>

    <WorkoutSupersetSheet v-model:open="supersetOpen" :options="supersetOptions" @group="groupWith" />

    <WorkoutExercisePicker v-model:open="pickerOpen" @pick="addExercise" />
  </div>
</template>
