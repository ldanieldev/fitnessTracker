<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'

interface CatalogEntry {
  key: string
  name: string
  unit: string
}

interface TrackedNutrient {
  key: string
}

const props = defineProps<{
  catalog: CatalogEntry[]
  tracked: TrackedNutrient[]
}>()

const toast = useToast()
const checked = reactive<Record<string, boolean>>({})

watch(
  () => [props.catalog, props.tracked] as const,
  ([catalog, tracked]) => {
    const trackedKeys = new Set(tracked.map((t) => t.key))
    for (const n of catalog) checked[n.key] = trackedKeys.has(n.key)
  },
  { immediate: true }
)

const saving = ref(false)

async function save() {
  const keys = props.catalog.filter((n) => checked[n.key]).map((n) => n.key)
  if (!keys.length) {
    toast.add({ title: 'Track at least one nutrient', color: 'error' })
    return
  }
  saving.value = true
  try {
    await apiFetch('/api/nutrition/nutrients/tracked', { method: 'PUT', body: { keys } })
    await invalidateNutrition(NUTRITION_KEYS.tracked, NUTRITION_KEYS.catalog)
    toast.add({ title: 'Tracked nutrients updated', color: 'success' })
  } catch (error: unknown) {
    toast.add({
      title: 'Update failed',
      description: errorMessage(error, 'Could not update tracked nutrients'),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <UCheckbox
        v-for="n in catalog"
        :key="n.key"
        v-model="checked[n.key]"
        :label="`${n.name} (${n.unit})`"
        :data-test="`tracked-${n.key}`"
      />
    </div>
    <UButton label="Save" class="w-fit" :loading="saving" data-test="tracked-save" @click="save" />
  </div>
</template>
