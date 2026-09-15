<script setup lang="ts">
import { useIsNarrow } from '../../composables/useIsNarrow'

defineProps<{
  title: string
  description?: string
  fullscreen?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const narrow = useIsNarrow()
</script>

<template>
  <LazyUDrawer
    v-if="narrow && !fullscreen"
    v-model:open="open"
    :title="title"
    :description="description"
    :ui="{ container: 'max-h-[85dvh] overscroll-contain' }"
  >
    <template #body>
      <slot name="body" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </LazyUDrawer>
  <UModal v-else v-model:open="open" :title="title" :description="description" :fullscreen="Boolean(fullscreen) && narrow">
    <template #body>
      <slot name="body" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UModal>
</template>
