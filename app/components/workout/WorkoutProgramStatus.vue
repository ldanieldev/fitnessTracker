<script setup lang="ts">
import { enrollmentBadge, enrollmentLine } from '~/utils/enrollmentLine'

const fail = useFailToast()
const { enrollment, dismiss } = useEnrollment()

const banner = computed(() => {
  const e = enrollment.value
  if (!e?.notice) return null
  if (e.notice === 'complete') return { title: `${e.program.name} complete`, description: 'No routine is active now.' }
  if (!e.phase) return null
  return {
    title: `${e.phase.name} started`,
    description: e.phase.routine
      ? `${e.phase.routine.name} is now your active routine.`
      : 'Rest week — no routine this week.'
  }
})
const badge = computed(() => (enrollment.value ? enrollmentBadge(enrollment.value) : null))

async function onDismiss() {
  try {
    await dismiss()
  } catch (err: unknown) {
    fail('Couldn\'t dismiss notice', err, 'Could not dismiss this')
  }
}
</script>

<template>
  <div v-if="enrollment" class="flex flex-col gap-2" data-test="program-status">
    <UAlert
      v-if="banner"
      :title="banner.title"
      :description="banner.description"
      color="neutral"
      variant="subtle"
      icon="i-lucide-flag"
      close
      data-test="program-banner"
      @update:open="
        (value: boolean) => {
          if (!value) onDismiss()
        }
      "
    />
    <NuxtLink
      v-if="enrollment.state !== 'finished'"
      to="/workouts/programs"
      class="flex min-h-10 items-center gap-2 text-sm text-muted"
      data-test="program-status-line"
    >
      <UIcon
        :name="enrollment.state === 'paused' ? 'i-lucide-pause' : 'i-lucide-calendar-range'"
        class="size-4 shrink-0"
      />
      <span class="truncate">{{ enrollment.program.name }} · {{ enrollmentLine(enrollment) }}</span>
      <UBadge
        v-if="badge"
        :label="badge"
        size="sm"
        variant="subtle"
        :color="badge === 'Deload' ? 'warning' : 'neutral'"
      />
    </NuxtLink>
  </div>
</template>
