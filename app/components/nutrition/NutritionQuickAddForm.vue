<script setup lang="ts">
import type { DiaryEntryInput } from '~/composables/useDiaryDay'

const props = defineProps<{
  containers: Array<{ id: number, name: string }>
  defaultContainerId?: number
}>()

const emit = defineEmits<{
  submit: [input: DiaryEntryInput]
}>()

const description = ref('')
const energy = ref('')
const protein = ref('')
const carbohydrate = ref('')
const fat = ref('')
const containerId = ref<number | undefined>(props.defaultContainerId ?? props.containers[0]?.id)

const containerItems = useContainerItems(() => props.containers)

const canSubmit = computed(() => description.value.trim().length > 0 && containerId.value !== undefined)

function submit() {
  if (!canSubmit.value) return

  const nutrients: Record<string, number> = {}
  const energyValue = numOrUndefined(energy.value)
  const proteinValue = numOrUndefined(protein.value)
  const carbohydrateValue = numOrUndefined(carbohydrate.value)
  const fatValue = numOrUndefined(fat.value)
  if (energyValue !== undefined) nutrients.energy = energyValue
  if (proteinValue !== undefined) nutrients.protein = proteinValue
  if (carbohydrateValue !== undefined) nutrients.carbohydrate = carbohydrateValue
  if (fatValue !== undefined) nutrients.fat = fatValue

  emit('submit', {
    entryType: 'quick_add',
    containerId: containerId.value!,
    description: description.value.trim(),
    quantity: 1,
    unitLabel: 'serving',
    nutrients
  })

  description.value = ''
  energy.value = ''
  protein.value = ''
  carbohydrate.value = ''
  fat.value = ''
}
</script>

<template>
  <UCard data-test="quick-add-form">
    <div class="flex flex-col gap-3">
      <UFormField label="Description">
        <UInput v-model="description" placeholder="e.g. Restaurant burger" class="w-full" data-test="quick-add-description" />
      </UFormField>
      <UFormField label="Container">
        <USelect v-model="containerId" :items="containerItems" class="w-full" />
      </UFormField>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Calories">
          <UInput v-model="energy" type="number" data-test="quick-add-energy" />
        </UFormField>
        <UFormField label="Protein (g)">
          <UInput v-model="protein" type="number" data-test="quick-add-protein" />
        </UFormField>
        <UFormField label="Carbohydrate (g)">
          <UInput v-model="carbohydrate" type="number" data-test="quick-add-carbohydrate" />
        </UFormField>
        <UFormField label="Fat (g)">
          <UInput v-model="fat" type="number" data-test="quick-add-fat" />
        </UFormField>
      </div>
      <UButton label="Add" :disabled="!canSubmit" class="w-fit" data-test="quick-add-submit" @click="submit" />
    </div>
  </UCard>
</template>
