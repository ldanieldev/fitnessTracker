<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{
  date: string
  profiles: Array<{ id: number, name: string, isDefault: boolean }>
  currentId: number | null
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ applied: [] }>()

const toast = useToast()
const selected = ref<number | null>(props.currentId)
const applying = ref(false)

watch(open, (isOpen) => {
  if (isOpen) selected.value = props.currentId
})

const canApply = computed(() => selected.value !== null && selected.value !== props.currentId)

async function apply() {
  if (!canApply.value || applying.value) return
  applying.value = true
  try {
    await $fetch(`/api/nutrition/diary/${props.date}/goal`, { method: 'PUT', body: { profileId: selected.value } })
    await invalidateNutrition(NUTRITION_KEYS.day(props.date))
  } catch (error: unknown) {
    toast.add({ title: 'Apply failed', description: errorMessage(error, 'Could not apply this goal profile'), color: 'error' })
    return
  } finally {
    applying.value = false
  }
  emit('applied')
  open.value = false
}
</script>

<template>
  <NutritionSheet v-model:open="open" title="Apply goal profile">
    <template #body>
      <div class="flex flex-col gap-3">
        <p class="text-sm text-dimmed">Changes this day's targets only.</p>
        <UAlert
          v-if="profiles.length === 0"
          data-test="goal-empty"
          title="No goal profiles yet"
          :actions="[{ label: 'Create one', to: '/settings/nutrition' }]"
        />
        <button
          v-for="profile in profiles"
          :key="profile.id"
          type="button"
          class="min-h-12 flex items-center gap-2 rounded-md border border-default px-3 py-2 text-left"
          :class="selected === profile.id ? 'ring ring-primary' : ''"
          :aria-pressed="selected === profile.id ? true : undefined"
          :data-test="`goal-option-${profile.id}`"
          @click="selected = profile.id"
        >
          <span class="flex-1 truncate">{{ profile.name }}</span>
          <UBadge v-if="profile.id === currentId" color="neutral" variant="subtle">Current</UBadge>
          <UBadge v-if="profile.isDefault" color="primary" variant="subtle">Default</UBadge>
        </button>
        <UButton v-if="profiles.length > 0" label="Apply" block :loading="applying" :disabled="!canApply || applying" data-test="goal-apply" @click="apply" />
      </div>
    </template>
  </NutritionSheet>
</template>
