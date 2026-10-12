<script setup lang="ts">
import { format } from 'date-fns'
import type { Ref } from 'vue'
import type { RoutineSummary } from '~~/shared/types/routine'
import type { StepWeek } from '~~/shared/types/steps'
import { formatValue } from '~~/shared/utils/bodyMetrics'
import { enrollmentLine, shortDate } from '~/utils/enrollmentLine'

type State = 'done' | 'open' | 'warn'
type Load = 'loading' | 'error' | 'ready'

interface Row {
  key: 'weighIn' | 'workout' | 'calories' | 'steps'
  label: string
  to: string
  load: Load
  state: State
  value: string
  secondary?: string
  progress?: number
}

interface Source {
  status: Ref<string>
  data: Ref<unknown>
}

const CALORIE_TOLERANCE = 0.1
const n = (value: number) => Math.round(value).toLocaleString('en-US')

// A 204 leaves data undefined after success, so only a fetch still idle or pending counts as loading.
function loadOf(...sources: Source[]): Load {
  if (sources.some((s) => s.status.value === 'error')) return 'error'
  const loading = (s: Source) => s.status.value === 'idle' || s.status.value === 'pending'
  return sources.some((s) => s.data.value === undefined && loading(s)) ? 'loading' : 'ready'
}

const today = useTodayOrNow()
const modules = useModules()

function bodySources() {
  const { metrics, fetch: overviewFetch } = useBodyOverview()
  const steps = useBodyFetch<StepWeek[]>(BODY_KEYS.stepWeeks(1), '/api/body/steps/weeks', {
    query: computed(() => ({ count: 1, to: today.value }))
  })
  return { metrics, overviewFetch, steps }
}

async function workoutSources() {
  const routines = useWorkoutFetch<RoutineSummary[]>(WORKOUT_KEYS.routines, '/api/workouts/routines', { lazy: true })
  const { enrollment } = useEnrollment()
  const consistency = useDashboardConsistency()
  const { start, starting } = useWorkoutStart()
  // Called last: it awaits on the server, and composables called after that await would lose the component instance.
  const active = await useActiveSession()
  return { routines, enrollment, consistency, start, starting, active }
}

// Read once so hidden modules never fetch; the dashboard page remounts the strip when a flag flips.
const body = modules.body.value ? bodySources() : null
const nutrition = modules.nutrition.value ? useTodaySummary() : null
const workouts = modules.workouts.value ? await workoutSources() : null

const bodyweight = computed(() => body?.metrics.value.find((m) => m.type.key === 'bodyweight') ?? null)
const logOpen = ref(false)
const activeSession = computed(() => workouts?.active.session.value ?? null)
const starting = computed(() => workouts?.starting.value ?? false)
const nextDay = computed(() => workouts?.routines.data.value?.find((r) => r.active && r.nextDay)?.nextDay ?? null)

async function startWorkout() {
  const session = await workouts?.start(nextDay.value ? { routineDayId: nextDay.value.id } : {})
  if (session) await navigateTo('/workouts/log')
}

function weighInRow(sources: NonNullable<typeof body>): Row {
  const latest = bodyweight.value?.latest ?? null
  const type = bodyweight.value?.type
  const done = latest?.measuredOn === today.value
  return {
    key: 'weighIn',
    label: 'Weigh-in',
    to: type ? `/body/${type.id}` : '/body',
    load: loadOf(sources.overviewFetch),
    state: done ? 'done' : 'open',
    value: done && type ? `${formatValue(latest!.value, type.precision)} ${type.unit}` : 'Not yet today',
    secondary:
      !done && latest && type
        ? `Last ${formatValue(latest.value, type.precision)} ${type.unit} · ${shortDate(latest.measuredOn)}`
        : undefined
  }
}

function workoutRow(sources: NonNullable<typeof workouts>): Row {
  const active = sources.active
  const open = active.session.value
  const done = !open && (sources.consistency.data.value?.days.includes(today.value) ?? false)
  const enrollment = sources.enrollment.value
  const program = enrollment?.state === 'current' ? enrollmentLine(enrollment) : undefined
  return {
    key: 'workout',
    label: 'Workout',
    to: '/workouts/log',
    load: loadOf(sources.consistency, sources.routines, { status: active.status, data: active.session }),
    state: done ? 'done' : 'open',
    value: open ? (open.name ?? 'Workout') : done ? 'Done today' : (nextDay.value?.name ?? 'No workout planned'),
    secondary: open ? 'In progress' : done ? undefined : program
  }
}

function caloriesRow(sources: NonNullable<typeof nutrition>): Row {
  const { targets, totals } = sources
  const set = targets.value.find((t) => t.key === 'energy')?.amount ?? 0
  const energy = set > 0 ? set : null
  const protein = targets.value.find((t) => t.key === 'protein')?.amount ?? null
  const eaten = totals.value.energy ?? 0
  const left = energy === null ? null : energy - eaten
  const state: State =
    energy === null
      ? 'open'
      : eaten > energy * (1 + CALORIE_TOLERANCE)
        ? 'warn'
        : Math.abs(energy - eaten) <= energy * CALORIE_TOLERANCE
          ? 'done'
          : 'open'
  return {
    key: 'calories',
    label: 'Calories',
    to: '/nutrition/diary/today',
    load: loadOf(sources.dayFetch, sources.trackedFetch),
    state,
    value: left === null ? `${n(eaten)} kcal eaten` : left >= 0 ? `${n(left)} kcal left` : `${n(-left)} kcal over`,
    secondary: protein === null ? undefined : `Protein ${n(Math.max(protein - (totals.value.protein ?? 0), 0))} g left`
  }
}

function stepsRow(sources: NonNullable<typeof body>): Row {
  const day = sources.steps.data.value?.[0]?.days.find((d) => d.date === today.value) ?? null
  const steps = day?.steps ?? 0
  const target = day?.target ?? null
  const met = target !== null && steps >= target
  return {
    key: 'steps',
    label: 'Steps',
    to: '/body/steps',
    load: loadOf(sources.steps),
    state: met ? 'done' : 'open',
    value: target === null || met ? `${n(steps)} steps` : `${n(target - steps)} to go`,
    secondary: target === null ? 'Set a goal' : met ? undefined : `${n(steps)} of ${n(target)}`,
    progress: target === null || met ? undefined : Math.min(1, steps / target)
  }
}

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  const showBody = body && modules.body.value
  if (showBody) out.push(weighInRow(body))
  if (workouts && modules.workouts.value) out.push(workoutRow(workouts))
  if (nutrition && modules.nutrition.value) out.push(caloriesRow(nutrition))
  if (showBody) out.push(stepsRow(body))
  return out.map((row) =>
    row.load === 'error' ? { ...row, state: 'open', value: '—', secondary: undefined, progress: undefined } : row
  )
})

const STATE_TEXT = { done: 'done', open: 'not done', warn: 'over target' }

const DOT = {
  done: 'bg-success text-inverted',
  open: 'ring-2 ring-inset ring-(--ui-border-accented)',
  warn: 'bg-warning text-inverted'
}
</script>

<template>
  <DashboardCard
    v-if="rows.length"
    title="Today"
    :aside="format(new Date(`${today}T00:00:00`), 'EEE, MMM d')"
    data-test="dashboard-today-strip"
  >
    <div class="flex flex-col divide-y divide-default">
      <template v-for="row in rows" :key="row.key">
        <div
          v-if="row.load === 'loading'"
          class="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
          data-test="today-skeleton"
        >
          <USkeleton class="size-5 shrink-0 rounded-full" />
          <span class="w-15 shrink-0 truncate text-sm text-muted">{{ row.label }}</span>
          <USkeleton class="h-4 flex-1" />
        </div>
        <div
          v-else
          class="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
          :data-test="`today-${row.key}`"
          :data-state="row.state"
        >
          <NuxtLink :to="row.to" class="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg hover:bg-accented">
            <span
              class="grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold"
              :class="DOT[row.state]"
            >
              <UIcon v-if="row.state === 'done'" name="i-lucide-check" class="size-3.5" />
              <UIcon v-else-if="row.state === 'warn'" name="i-lucide-alert-triangle" class="size-3" />
            </span>
            <span class="w-15 shrink-0 truncate text-sm text-muted">{{ row.label }}</span>
            <span class="sr-only">{{ STATE_TEXT[row.state] }}</span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm text-highlighted" data-test="today-value">{{ row.value }}</span>
              <span v-if="row.progress !== undefined" class="mt-1 h-1 overflow-hidden rounded-full bg-accented">
                <span class="block h-full bg-blue-500" :style="{ width: `${Math.round(row.progress * 100)}%` }" />
              </span>
              <span v-if="row.secondary" class="truncate text-xs text-dimmed">{{ row.secondary }}</span>
            </span>
          </NuxtLink>
          <template v-if="row.load === 'ready'">
            <UButton
              v-if="row.key === 'weighIn' && row.state === 'open' && bodyweight"
              icon="i-lucide-plus"
              size="sm"
              variant="subtle"
              aria-label="Log weigh-in"
              data-test="today-log-weight"
              @click="logOpen = true"
            />
            <UButton
              v-else-if="row.key === 'workout' && activeSession"
              label="Resume"
              size="sm"
              to="/workouts/log"
              data-test="today-resume"
            />
            <UButton
              v-else-if="row.key === 'workout' && row.state === 'open'"
              label="Start"
              size="sm"
              :loading="starting"
              data-test="today-start"
              @click="startWorkout"
            />
          </template>
        </div>
      </template>
    </div>
    <BodyEntrySheet
      v-if="bodyweight"
      v-model:open="logOpen"
      :type="bodyweight.type"
      :entry="null"
      @saved="refreshNuxtData('dashboard:bodyweight')"
    />
  </DashboardCard>
</template>
