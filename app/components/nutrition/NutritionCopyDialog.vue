<script setup lang="ts">
import { applyOverrides, type CopyOverride } from '~~/shared/utils/nutritionCopy'

interface CopySourceEntry {
  id: number
  containerId: number
  description: string | null
  quantity: number
  unitLabel: string
}

const props = defineProps<{
  open: boolean
  sourceEntries: CopySourceEntry[]
  containers: Array<{ id: number, name: string }>
  defaultDate: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [payload: {
    sourceEntryIds: number[]
    targetDate: string
    targetContainerId: number | null
    overrides: CopyOverride[]
  }]
}>()

const KEEP_ORIGINAL_CONTAINER = '__keep_original__'

const targetDate = ref(props.defaultDate)
const targetContainerRaw = ref(KEEP_ORIGINAL_CONTAINER)
const checked = reactive(new Map<number, boolean>())
const quantities = reactive(new Map<number, number>())

const containerItems = computed(() => [
  { label: 'Keep original container', value: KEEP_ORIGINAL_CONTAINER },
  ...props.containers.map((c) => ({ label: c.name, value: String(c.id) }))
])

const targetContainerId = computed(() =>
  targetContainerRaw.value === KEEP_ORIGINAL_CONTAINER ? null : Number(targetContainerRaw.value)
)

function resetState() {
  targetDate.value = props.defaultDate
  targetContainerRaw.value = KEEP_ORIGINAL_CONTAINER
  checked.clear()
  quantities.clear()
  for (const entry of props.sourceEntries) {
    checked.set(entry.id, true)
    quantities.set(entry.id, entry.quantity)
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) resetState()
})
watch(() => props.sourceEntries, resetState, { immediate: true })

const overrides = computed<CopyOverride[]>(() =>
  props.sourceEntries.flatMap((entry): CopyOverride[] => {
    if (!(checked.get(entry.id) ?? true)) return [{ sourceEntryId: entry.id, exclude: true }]
    const quantity = quantities.get(entry.id) ?? entry.quantity
    if (quantity !== entry.quantity) return [{ sourceEntryId: entry.id, quantity }]
    return []
  })
)

const previewCount = computed(() => {
  try {
    return applyOverrides(props.sourceEntries, overrides.value, targetContainerId.value).length
  } catch {
    return 0
  }
})

const canConfirm = computed(() => previewCount.value > 0)

function confirm() {
  if (!canConfirm.value) return
  emit('confirm', {
    sourceEntryIds: props.sourceEntries.map((entry) => entry.id),
    targetDate: targetDate.value,
    targetContainerId: targetContainerId.value,
    overrides: overrides.value
  })
}
</script>

<template>
  <NutritionSheet :open="open" title="Copy entries" @update:open="emit('update:open', $event)">
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField label="Target date">
          <UInput v-model="targetDate" type="date" data-test="copy-target-date" />
        </UFormField>
        <UFormField label="Target container">
          <USelect v-model="targetContainerRaw" :items="containerItems" data-test="copy-target-container" />
        </UFormField>

        <div class="flex flex-col gap-2">
          <div
            v-for="entry in sourceEntries"
            :key="entry.id"
            class="flex flex-wrap items-center gap-2"
            data-test="copy-source-row"
          >
            <UCheckbox
              :model-value="checked.get(entry.id) ?? true"
              data-test="copy-source-checkbox"
              @update:model-value="(value) => checked.set(entry.id, Boolean(value))"
            />
            <span class="flex-1">{{ entry.description }}</span>
            <NutritionNumberInput
              :model-value="quantities.get(entry.id) ?? entry.quantity"
              :min="0"
              class="w-20"
              aria-label="Quantity"
              data-test="copy-source-quantity"
              @update:model-value="(value) => quantities.set(entry.id, value ?? 0)"
            />
            <span class="text-dimmed text-sm">{{ entry.unitLabel }}</span>
          </div>
        </div>

        <p class="text-sm text-dimmed" data-test="copy-preview">
          {{ previewCount }} item{{ previewCount === 1 ? '' : 's' }} will be copied
        </p>

        <div class="flex gap-2">
          <UButton label="Cancel" variant="outline" color="neutral" @click="emit('update:open', false)" />
          <UButton label="Copy" class="ml-auto" :disabled="!canConfirm" data-test="copy-confirm" @click="confirm" />
        </div>
      </div>
    </template>
  </NutritionSheet>
</template>
