<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'

interface ServingRow {
  kind: 'weight' | 'named'
  label: string
  quantity: number
  energy: string
  protein: string
  carbohydrate: string
  fat: string
  basisGrams: string
}

const emit = defineEmits<{
  created: [id: number]
}>()

const toast = useToast()

const name = ref('')
const brand = ref('')
const barcode = ref('')
const loading = ref(false)

function newRow(): ServingRow {
  return { kind: 'named', label: '', quantity: 1, energy: '', protein: '', carbohydrate: '', fat: '', basisGrams: '' }
}

const servings = reactive<ServingRow[]>([newRow()])

const weightLabelItems = [
  { label: 'g', value: 'g' },
  { label: 'oz', value: 'oz' },
  { label: 'lb', value: 'lb' }
]

function kindItems(index: number) {
  const weightUsedElsewhere = servings.some((row, i) => i !== index && row.kind === 'weight')
  return [
    { label: 'Weight', value: 'weight', disabled: weightUsedElsewhere },
    { label: 'Named', value: 'named' }
  ]
}

watch(
  () => servings.map((row) => row.kind),
  () => {
    for (const row of servings) {
      if (row.kind === 'weight' && !weightLabelItems.some((item) => item.value === row.label)) row.label = 'g'
    }
  }
)

function addRow() {
  servings.push(newRow())
}

function removeRow(index: number) {
  if (servings.length > 1) servings.splice(index, 1)
}

function rowNutrients(row: ServingRow): Record<string, number> {
  const nutrients: Record<string, number> = {}
  const energy = numOrUndefined(row.energy)
  const protein = numOrUndefined(row.protein)
  const carbohydrate = numOrUndefined(row.carbohydrate)
  const fat = numOrUndefined(row.fat)
  if (energy !== undefined) nutrients.energy = energy
  if (protein !== undefined) nutrients.protein = protein
  if (carbohydrate !== undefined) nutrients.carbohydrate = carbohydrate
  if (fat !== undefined) nutrients.fat = fat
  return nutrients
}

const rowErrors = computed(() =>
  servings.map((row) => {
    const hasNutrients = Object.keys(rowNutrients(row)).length > 0
    if (row.kind === 'weight' && !hasNutrients) {
      return 'A weight serving must carry its own nutrition'
    }
    if (!hasNutrients && numOrUndefined(row.basisGrams) === undefined) {
      return 'A serving without its own nutrition needs a gram weight'
    }
    return null
  })
)

const canSubmit = computed(() =>
  name.value.trim().length > 0 &&
  servings.every((row) => row.label.trim().length > 0 && row.quantity > 0) &&
  rowErrors.value.every((error) => error === null)
)

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  try {
    const result = await $fetch<{ id: number }>('/api/nutrition/foods', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        brand: brand.value.trim() || undefined,
        barcode: barcode.value.trim() || undefined,
        servings: servings.map((row) => {
          const nutrients = rowNutrients(row)
          const hasNutrients = Object.keys(nutrients).length > 0
          const basisGrams = numOrUndefined(row.basisGrams)
          return {
            kind: row.kind,
            label: row.label.trim(),
            quantity: row.quantity,
            ...(hasNutrients ? { nutrients } : {}),
            ...(basisGrams !== undefined ? { basisGrams } : {})
          }
        })
      }
    })
    emit('created', result.id)
  } catch (err: unknown) {
    toast.add({
      title: 'Failed to create food',
      description: errorMessage(err, 'Could not create food'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-4">
      <UFormField label="Name" required>
        <UInput v-model="name" class="w-full" data-test="food-name" />
      </UFormField>
      <UFormField label="Brand">
        <UInput v-model="brand" class="w-full" />
      </UFormField>
      <UFormField label="Barcode">
        <UInput v-model="barcode" class="w-full" />
      </UFormField>

      <div class="flex flex-col gap-3">
        <div
          v-for="(row, index) in servings"
          :key="index"
          class="flex flex-col gap-2 p-3 rounded-lg bg-elevated/50"
          data-test="serving-row"
        >
          <div class="flex gap-2 items-center">
            <USelect v-model="row.kind" :items="kindItems(index)" class="w-32" data-test="serving-kind" />
            <UInput v-if="row.kind === 'named'" v-model="row.label" placeholder="e.g. slice" class="flex-1" data-test="serving-label" />
            <USelect v-else v-model="row.label" :items="weightLabelItems" class="w-24" data-test="serving-label" />
            <UInputNumber v-model="row.quantity" :min="0" class="w-28" data-test="serving-quantity" />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="xs"
              aria-label="Remove serving"
              :disabled="servings.length === 1"
              @click="removeRow(index)"
            />
          </div>
          <div class="grid grid-cols-4 gap-2">
            <UInput v-model="row.energy" type="number" placeholder="kcal" data-test="serving-energy" />
            <UInput v-model="row.protein" type="number" placeholder="protein g" data-test="serving-protein" />
            <UInput v-model="row.carbohydrate" type="number" placeholder="carb g" data-test="serving-carbohydrate" />
            <UInput v-model="row.fat" type="number" placeholder="fat g" data-test="serving-fat" />
          </div>
          <UInput
            v-if="row.kind === 'named'"
            v-model="row.basisGrams"
            type="number"
            placeholder="Gram weight (optional; required if no macros above)"
            class="w-full"
            data-test="serving-basis-grams"
          />
          <p v-if="rowErrors[index]" class="text-xs text-error" data-test="serving-error">{{ rowErrors[index] }}</p>
        </div>
        <UButton label="Add serving" variant="soft" color="neutral" class="w-fit" @click="addRow" />
      </div>

      <UButton label="Create food" :disabled="!canSubmit" :loading="loading" class="w-fit" data-test="food-submit" @click="submit" />
    </div>
  </UCard>
</template>
