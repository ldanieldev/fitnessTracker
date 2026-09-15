<script setup lang="ts">
import type { Period, Range, Stat } from '~/types'

const props = defineProps<{
  period: Period
  range: Range
}>()

function pluralize(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : plural
}

const baseStats = [
  {
    title: 'Workouts',
    icon: 'i-lucide-dumbbell',
    minValue: 3,
    maxValue: 12,
    minVariation: -10,
    maxVariation: 20,
    unit: ['session', 'sessions'] as const
  },
  {
    title: 'Volume',
    icon: 'i-lucide-weight',
    minValue: 5000,
    maxValue: 25000,
    minVariation: -10,
    maxVariation: 25,
    unit: ['lb', 'lbs'] as const
  },
  {
    title: 'Calories Burned',
    icon: 'i-lucide-flame',
    minValue: 1500,
    maxValue: 5000,
    minVariation: -5,
    maxVariation: 15,
    unit: ['calorie', 'calories'] as const
  },
  {
    title: 'Active Days',
    icon: 'i-lucide-calendar-check',
    minValue: 2,
    maxValue: 7,
    minVariation: -15,
    maxVariation: 30,
    unit: ['day', 'days'] as const
  }
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const { data: stats } = await useAsyncData<Stat[]>(
  'stats',
  async () => {
    return baseStats.map((stat) => {
      const value = randomInt(stat.minValue, stat.maxValue)
      const variation = randomInt(stat.minVariation, stat.maxVariation)

      return {
        title: stat.title,
        icon: stat.icon,
        value: value.toLocaleString(),
        unit: pluralize(value, stat.unit[0], stat.unit[1]),
        variation
      }
    })
  },
  {
    watch: [() => props.period, () => props.range],
    default: () => []
  }
)
</script>

<template>
  <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
    <UPageCard
      v-for="(stat, index) in stats"
      :key="index"
      :icon="stat.icon"
      :title="stat.title"
      to="/#"
      variant="subtle"
      :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
        title: 'font-normal text-muted text-xs uppercase'
      }"
      class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
    >
      <div class="flex items-center gap-2">
        <span class="text-2xl font-semibold text-highlighted">
          {{ stat.value }}
        </span>
        <span class="text-sm text-muted">
          {{ stat.unit }}
        </span>

        <UBadge :color="stat.variation > 0 ? 'success' : 'error'" variant="subtle" class="text-xs">
          {{ stat.variation > 0 ? '+' : '' }}{{ stat.variation }}%
        </UBadge>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
