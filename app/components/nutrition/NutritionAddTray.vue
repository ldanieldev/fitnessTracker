<script setup lang="ts">
interface TrayItem {
  kind: 'food' | 'recipe' | 'meal'
  id: number
  label: string
  detail: string
}

defineProps<{
  count: number
  ready: boolean
  containerName: string
  items: TrayItem[]
}>()

const emit = defineEmits<{
  submit: []
  remove: [kind: 'food' | 'recipe' | 'meal', id: number]
}>()

const sheetOpen = ref(false)
</script>

<template>
  <div
    v-if="count > 0"
    class="fixed inset-x-0 bottom-0 z-10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-default/95 border-t border-default lg:static lg:border-0 lg:bg-transparent"
  >
    <div class="max-w-2xl mx-auto w-full flex items-center gap-2">
      <UButton
        :label="`${count} selected`"
        variant="ghost"
        color="neutral"
        data-test="tray-count"
        @click="sheetOpen = true"
      />
      <UButton
        :label="`Add to ${containerName}`"
        :disabled="!ready"
        class="ml-auto"
        data-test="add-selected"
        @click="emit('submit')"
      />
    </div>

    <NutritionSheet v-model:open="sheetOpen" title="Selected">
      <template #body>
        <div class="flex flex-col gap-2">
          <div v-for="item in items" :key="`${item.kind}-${item.id}`" class="flex items-center gap-2 p-2 rounded-lg bg-elevated/50" data-test="tray-item">
            <div class="flex flex-col min-w-0 flex-1">
              <span class="font-medium truncate">{{ item.label }}</span>
              <span class="text-dimmed text-xs">{{ item.detail }}</span>
            </div>
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="xs"
              aria-label="Remove"
              data-test="tray-item-remove"
              @click="emit('remove', item.kind, item.id)"
            />
          </div>
        </div>
      </template>
    </NutritionSheet>
  </div>
</template>
