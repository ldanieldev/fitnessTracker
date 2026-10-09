<script setup lang="ts">
import type { RestTimer } from '~/composables/useRestTimer'

const open = defineModel<boolean>('open', { default: false })
defineProps<{ timer: RestTimer }>()
</script>

<template>
  <UDrawer v-model:open="open" direction="bottom" handle :dismissible="true" :should-scale-background="false">
    <template #default />

    <template #content>
      <WorkoutTimerPanel :timer="timer" class="px-6 pb-8 pt-2" data-test="rest-timer" @skip="open = false" />
    </template>
  </UDrawer>
</template>
