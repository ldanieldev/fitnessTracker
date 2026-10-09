<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Routine, RoutineSummary } from '~~/shared/types/routine'
import WorkoutPauseProgramPrompt from '~/components/workout/WorkoutPauseProgramPrompt.vue'

const { data } = await useWorkoutFetch<RoutineSummary[]>(WORKOUT_KEYS.routines, '/api/workouts/routines')
const routines = computed(() => data.value ?? [])

const newOpen = ref(false)
const newName = ref('')
const deleting = ref<RoutineSummary | null>(null)
const deleteOpen = ref(false)

const fail = useFailToast()

async function create() {
  const name = newName.value.trim()
  if (!name) return
  try {
    const routine = await apiFetch<Routine>('/api/workouts/routines', { method: 'POST', body: { name } })
    newOpen.value = false
    newName.value = ''
    await invalidateWorkouts()
    await navigateTo(`/workouts/routines/${routine.id}`)
  } catch (err: unknown) {
    fail('Couldn\'t create routine', err, 'Could not create this routine', create)
  }
}

const pausePrompt = usePauseProgramPrompt()
const { open: pauseOpen, programName: pauseName } = pausePrompt
async function setActive(routine: RoutineSummary) {
  try {
    await pausePrompt.guarded(
      (extra) =>
        apiFetch(`/api/workouts/routines/${routine.id}`, { method: 'PATCH', body: { active: true, ...extra } }),
      () => invalidateWorkouts()
    )
  } catch (err: unknown) {
    fail('Couldn\'t change active routine', err, 'Could not change the active routine')
  }
}
async function confirmPause() {
  try {
    await pausePrompt.confirm()
  } catch (err: unknown) {
    fail('Couldn\'t change active routine', err, 'Could not change the active routine')
  }
}

async function duplicate(routine: RoutineSummary) {
  try {
    const copy = await apiFetch<Routine>(`/api/workouts/routines/${routine.id}/duplicate`, { method: 'POST' })
    await invalidateWorkouts()
    await navigateTo(`/workouts/routines/${copy.id}`)
  } catch (err: unknown) {
    fail('Couldn\'t duplicate routine', err, 'Could not duplicate this routine', () => duplicate(routine))
  }
}

async function confirmDelete() {
  const routine = deleting.value
  deleteOpen.value = false
  if (!routine) return
  try {
    await apiFetch(`/api/workouts/routines/${routine.id}`, { method: 'DELETE' })
    await invalidateWorkouts()
  } catch (err: unknown) {
    fail('Couldn\'t delete routine', err, 'Could not delete this routine')
  }
}

function menu(routine: RoutineSummary): DropdownMenuItem[][] {
  return [
    [
      {
        label: 'Set active',
        icon: 'i-lucide-star',
        disabled: routine.active || routine.dayCount === 0,
        testId: `routine-set-active-${routine.id}`,
        onSelect: () => setActive(routine)
      },
      {
        label: 'Duplicate',
        icon: 'i-lucide-copy',
        testId: `routine-duplicate-${routine.id}`,
        onSelect: () => duplicate(routine)
      }
    ],
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error',
        testId: `routine-delete-${routine.id}`,
        onSelect: () => {
          deleting.value = routine
          deleteOpen.value = true
        }
      }
    ]
  ]
}

function dayCountLabel(count: number) {
  return `${count} ${count === 1 ? 'day' : 'days'}`
}
</script>

<template>
  <UDashboardPanel id="workout-routines">
    <template #header>
      <UDashboardNavbar title="Routines">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="New"
            icon="i-lucide-plus"
            size="sm"
            aria-label="New routine"
            data-test="routine-new"
            @click="newOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <p v-if="!routines.length" class="text-sm text-dimmed" data-test="routines-empty">
          No routines yet. A routine is a set of days you rotate through, like Upper / Lower.
        </p>
        <div
          v-for="routine in routines"
          :key="routine.id"
          class="flex items-center gap-2 rounded-lg border border-default bg-default px-3 py-2"
        >
          <NuxtLink
            :to="`/workouts/routines/${routine.id}`"
            class="flex min-h-10 min-w-0 flex-1 flex-col justify-center"
            :data-test="`routine-row-${routine.id}`"
          >
            <span class="flex items-center gap-2">
              <span class="truncate font-medium text-highlighted">{{ routine.name }}</span>
              <UBadge
                v-if="routine.active"
                label="Active"
                color="primary"
                variant="subtle"
                size="sm"
                :data-test="`routine-active-${routine.id}`"
              />
            </span>
            <span class="truncate text-xs text-dimmed" :data-test="`routine-next-${routine.id}`">
              {{ dayCountLabel(routine.dayCount)
              }}<template v-if="routine.nextDay"> · next: {{ routine.nextDay.name }}</template>
            </span>
          </NuxtLink>
          <UDropdownMenu :items="menu(routine)">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              variant="ghost"
              color="neutral"
              class="size-10 justify-center"
              aria-label="Routine actions"
              :data-test="`routine-menu-${routine.id}`"
            />
            <template #item-label="{ item }">
              <span :data-test="item.testId">{{ item.label }}</span>
            </template>
          </UDropdownMenu>
        </div>
      </div>

      <WorkoutPauseProgramPrompt v-model:open="pauseOpen" :program-name="pauseName" @confirm="confirmPause" />

      <AppSheet v-model:open="newOpen" title="New routine">
        <template #body>
          <form class="flex flex-col gap-3" @submit.prevent="create">
            <UInput v-model="newName" placeholder="e.g. Upper / Lower" autofocus data-test="routine-new-name" />
            <UButton
              type="submit"
              label="Create"
              block
              class="min-h-10"
              :disabled="!newName.trim()"
              data-test="routine-new-save"
            />
          </form>
        </template>
      </AppSheet>

      <UModal
        v-model:open="deleteOpen"
        :title="`Delete ${deleting?.name ?? 'routine'}?`"
        description="Its days are deleted too. Logged workouts stay."
        :ui="{ footer: 'justify-end' }"
      >
        <template #footer>
          <UButton label="Cancel" color="neutral" variant="outline" class="min-h-10" @click="deleteOpen = false" />
          <UButton
            label="Delete"
            color="error"
            class="min-h-10"
            data-test="routine-delete-confirm"
            @click="confirmDelete"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
