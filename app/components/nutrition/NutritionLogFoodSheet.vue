<script setup lang="ts">
import type { FoodDetail } from '~/types/nutrition'
import { defaultUnit } from '~/composables/useFoodUnits'
import { useIsNarrow } from '~/composables/useIsNarrow'
import { todayDate } from '~~/shared/utils/nutritionSummary'

const props = defineProps<{ food: FoodDetail }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const narrow = useIsNarrow()
const { idToKey } = useNutrientCatalog()
const nutrientKeys = computed(() => Object.fromEntries(idToKey.value))
const { data: containers } = useNutritionFetch<Array<{ id: number; name: string }>>(
  NUTRITION_KEYS.containers,
  '/api/nutrition/meal-containers'
)
const containerItems = useContainerItems(() => containers.value ?? [])

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

const date = ref(todayDate())
const containerId = ref<number | undefined>()
const amount = ref({ quantity: 1, unitLabel: '' })
const pickerOpen = ref(false)
const saving = ref(false)
const { logEntries } = useDiaryDay(date, { immediate: false })

const dateLabel = computed(() => DATE_FORMAT.format(new Date(`${date.value}T00:00:00`)))
const containerName = computed(() => containers.value?.find((c) => c.id === containerId.value)?.name ?? '')
const canAdd = computed(() => containerId.value !== undefined && amount.value.quantity > 0 && !saving.value)

function defaultAmount(food: FoodDetail) {
  const serving = food.servings.find((s) => s.id === food.defaultServingId)
  if (!serving) return { quantity: 1, unitLabel: defaultUnit(food) }
  return serving.kind === 'weight'
    ? { quantity: serving.quantity, unitLabel: 'g' }
    : { quantity: 1, unitLabel: serving.label }
}

watch(
  open,
  (value) => {
    if (!value) return
    date.value = useToday().value ?? todayDate()
    containerId.value = containers.value?.[0]?.id
    amount.value = defaultAmount(props.food)
  },
  { immediate: true }
)

watch(containers, (list) => {
  if (containerId.value === undefined) containerId.value = list?.[0]?.id
})

async function add() {
  if (!canAdd.value) return
  saving.value = true
  try {
    const result = await logEntries([
      { entryType: 'food', containerId: containerId.value!, foodId: props.food.id, ...amount.value }
    ])
    if (!result) return
    open.value = false
    const day = date.value
    toast.add({
      title: `Added to ${containerName.value} · ${dateLabel.value}`,
      color: 'success',
      actions: [{ label: 'View diary', onClick: () => navigateTo(`/nutrition/diary/${day}`) }]
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppSheet v-model:open="open" :title="`Add ${food.name}`">
    <template #body>
      <div class="flex flex-col gap-3">
        <UFormField label="Meal">
          <USelect v-model="containerId" :items="containerItems" class="w-full" data-test="log-food-container" />
        </UFormField>
        <UFormField label="Date">
          <NutritionDatePicker v-if="!narrow" v-model:open="pickerOpen" :date="date" @pick="(d) => (date = d)">
            <UButton
              :label="dateLabel"
              icon="i-lucide-calendar"
              color="neutral"
              variant="outline"
              class="w-full"
              data-test="log-food-date"
              :data-date="date"
            />
          </NutritionDatePicker>
          <UButton
            v-else
            :label="dateLabel"
            icon="i-lucide-calendar"
            color="neutral"
            variant="outline"
            class="w-full"
            data-test="log-food-date"
            :data-date="date"
            @click="pickerOpen = true"
          />
        </UFormField>
        <UFormField label="Amount">
          <NutritionAmountInput
            v-model="amount"
            :food="food"
            :nutrient-keys="nutrientKeys"
            quantity-test="log-food-quantity"
            unit-test="log-food-unit"
          />
        </UFormField>
        <UButton label="Add" block :loading="saving" :disabled="!canAdd" data-test="log-food-add" @click="add" />
      </div>
      <NutritionDatePicker v-if="narrow" v-model:open="pickerOpen" :date="date" @pick="(d) => (date = d)" />
    </template>
  </AppSheet>
</template>
