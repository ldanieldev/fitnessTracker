<script setup lang="ts">
import type { StartWhen } from '~~/shared/types/program'
import { anchorFor } from '~~/shared/utils/programs'
import { shortDate } from '~/utils/enrollmentLine'

const props = defineProps<{ title: string; week: number; today: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ choose: [when: StartWhen] }>()
const { user } = useUserSession()
const nextStart = computed(() => anchorFor('next', props.today, user.value?.weekStart ?? 1))

function choose(when: StartWhen) {
  open.value = false
  emit('choose', when)
}
</script>

<template>
  <AppSheet v-model:open="open" :title="title">
    <template #body>
      <div class="flex flex-col gap-2">
        <UButton block class="min-h-14 justify-start" data-test="when-now" @click="choose('now')">
          <span class="flex flex-col items-start text-left">
            <span class="font-semibold">Start now</span>
            <span class="text-xs opacity-80">Week {{ week }} counts from today</span>
          </span>
        </UButton>
        <UButton
          block
          variant="outline"
          color="neutral"
          class="min-h-14 justify-start"
          data-test="when-next"
          @click="choose('next')"
        >
          <span class="flex flex-col items-start text-left">
            <span class="font-semibold">Start next week</span>
            <span class="text-xs opacity-80">Week {{ week }} begins {{ shortDate(nextStart) }}</span>
          </span>
        </UButton>
      </div>
    </template>
  </AppSheet>
</template>
