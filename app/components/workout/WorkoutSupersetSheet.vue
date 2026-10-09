<script setup lang="ts">
defineProps<{ options: { id: number; name: string }[]; busy?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ group: [ids: number[]] }>()
const picked = ref<number[]>([])

watch(
  open,
  (isOpen) => {
    if (isOpen) picked.value = []
  },
  { immediate: true }
)

function toggle(id: number) {
  picked.value = picked.value.includes(id) ? picked.value.filter((value) => value !== id) : [...picked.value, id]
}

function confirm() {
  open.value = false
  emit('group', [...picked.value])
}
</script>

<template>
  <AppSheet
    v-model:open="open"
    title="Superset with…"
    description="Logging a set jumps to the next exercise in the group."
  >
    <template #body>
      <div class="flex flex-col gap-1">
        <p v-if="!options.length" class="text-sm text-dimmed">Add another exercise first.</p>
        <button
          v-for="option in options"
          :key="option.id"
          type="button"
          class="flex min-h-10 items-center gap-2 rounded-lg px-2 text-left hover:bg-elevated"
          :aria-pressed="picked.includes(option.id)"
          :data-test="`superset-option-${option.id}`"
          @click="toggle(option.id)"
        >
          <UIcon
            :name="picked.includes(option.id) ? 'i-lucide-square-check' : 'i-lucide-square'"
            class="size-5 shrink-0"
          />
          <span class="truncate">{{ option.name }}</span>
        </button>
      </div>
    </template>
    <template #footer>
      <UButton
        label="Superset"
        block
        class="min-h-10"
        :disabled="busy || !picked.length"
        data-test="superset-confirm"
        @click="confirm"
      />
    </template>
  </AppSheet>
</template>
