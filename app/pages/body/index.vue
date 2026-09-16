<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { MeasurementType, MetricOverview } from '~~/shared/types/body'
import { errorMessage } from '~/utils/apiError'

const { metrics, fetch } = useBodyOverview()
const allTypes = useBodyFetch<MeasurementType[]>(BODY_KEYS.typesAll, '/api/body/types?includeHidden=1')
await Promise.all([fetch, allTypes])

const toast = useToast()
const hiddenTypes = computed(() => (allTypes.data.value ?? []).filter((t) => t.hidden))

const logType = ref<MeasurementType | null>(null)
const logOpen = ref(false)
const editType = ref<MeasurementType | null>(null)
const typeOpen = ref(false)

function openLog(type: MeasurementType) {
  logType.value = type
  logOpen.value = true
}

function openType(type: MeasurementType | null) {
  editType.value = type
  typeOpen.value = true
}

async function setHidden(type: MeasurementType, hidden: boolean) {
  try {
    await apiFetch(`/api/body/types/${type.id}/prefs`, { method: 'PUT', body: { hidden } })
    await invalidateBody(BODY_KEYS.overview, BODY_KEYS.types, BODY_KEYS.typesAll)
  } catch (error: unknown) {
    toast.add({ title: 'Update failed', description: errorMessage(error, 'Could not update this measurement'), color: 'error' })
  }
}

function menuFor(metric: MetricOverview): DropdownMenuItem[] {
  const items: DropdownMenuItem[] = [{ label: 'Hide', icon: 'i-lucide-eye-off', onSelect: () => setHidden(metric.type, true) }]
  if (!metric.type.builtIn) items.unshift({ label: 'Edit…', icon: 'i-lucide-pencil', onSelect: () => openType(metric.type) })
  return items
}
</script>

<template>
  <UDashboardPanel id="body">
    <template #header>
      <UDashboardNavbar title="Measurements">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="New" size="sm" data-test="new-type" @click="openType(null)" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <BodyMetricCard v-for="metric in metrics" :key="metric.type.id" :metric="metric" :menu-items="menuFor(metric)" @log="openLog(metric.type)">
            <template #spark>
              <BodySparkline :points="metric.sparkline" />
            </template>
          </BodyMetricCard>
        </div>
        <p v-if="metrics.length === 0" class="text-sm text-dimmed" data-test="metrics-empty">Every measurement is hidden</p>
        <section v-if="hiddenTypes.length" class="flex flex-col gap-2" data-test="hidden-types">
          <h2 class="text-xs font-medium uppercase text-dimmed">Hidden</h2>
          <div v-for="type in hiddenTypes" :key="type.id" class="flex min-h-12 items-center gap-3 rounded-md border border-default px-3">
            <span class="flex-1 truncate text-sm">{{ type.name }}</span>
            <UButton label="Show" size="sm" variant="soft" color="neutral" :data-test="`show-type-${type.id}`" @click="setHidden(type, false)" />
          </div>
        </section>
      </div>
      <BodyEntrySheet v-model:open="logOpen" :type="logType" :entry="null" />
      <BodyTypeSheet v-model:open="typeOpen" :type="editType" />
    </template>
  </UDashboardPanel>
</template>
