<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'
import { saveAsSummary } from '~/utils/nutrition/saveAs'

const props = defineProps<{
  kind: 'recipe' | 'saved-meal'
  date: string
  containerId: number
  containerName: string
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [id: number] }>()

const toast = useToast()
const name = ref('')
const servings = ref(1)
const servingName = ref('serving')
const saving = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = ''
  servings.value = 1
  servingName.value = 'serving'
})

const title = computed(() => (props.kind === 'recipe' ? 'Save as recipe' : 'Save as saved meal'))
const description = computed(() => `From ${props.containerName} on ${props.date}`)

const canSubmit = computed(() => {
  if (name.value.length < 1 || name.value.length > 255) return false
  if (props.kind === 'recipe') {
    if (!(servings.value > 0)) return false
    if (servingName.value.length < 1 || servingName.value.length > 64) return false
  }
  return true
})

async function submit() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  const path = props.kind === 'recipe' ? '/api/nutrition/recipes/from-diary' : '/api/nutrition/saved-meals/from-diary'
  const body: Record<string, unknown> = { date: props.date, containerId: props.containerId, name: name.value }
  if (props.kind === 'recipe') {
    body.servings = servings.value
    body.servingName = servingName.value
  }

  let result: { id: number, skippedQuickAdds: number, flattenedRecipes: number }
  try {
    result = await $fetch(path, { method: 'POST', body })
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save this meal'), color: 'error' })
    return
  } finally {
    saving.value = false
  }

  open.value = false
  emit('saved', result.id)
  const editorPath = props.kind === 'recipe' ? `/nutrition/recipes/${result.id}` : `/nutrition/saved-meals/${result.id}`
  toast.add({
    title: saveAsSummary(result.skippedQuickAdds, result.flattenedRecipes),
    color: 'success',
    actions: [{ label: 'Open', onClick: () => navigateTo(editorPath) }]
  })
}
</script>

<template>
  <NutritionSheet v-model:open="open" :title="title" :description="description">
    <template #body>
      <div class="flex flex-col gap-3">
        <UFormField label="Name">
          <UInput v-model="name" class="w-full" data-test="save-meal-name" />
        </UFormField>
        <template v-if="kind === 'recipe'">
          <UFormField label="Servings">
            <UInputNumber v-model="servings" :min="0" class="w-full" data-test="save-meal-servings" />
          </UFormField>
          <UFormField label="Serving name">
            <UInput v-model="servingName" class="w-full" data-test="save-meal-serving-name" />
          </UFormField>
        </template>
      </div>
    </template>
    <template #footer>
      <UButton label="Save" block :loading="saving" :disabled="!canSubmit || saving" data-test="save-meal-submit" @click="submit" />
    </template>
  </NutritionSheet>
</template>
