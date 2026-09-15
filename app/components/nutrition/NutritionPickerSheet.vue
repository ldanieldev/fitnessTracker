<script setup lang="ts">
import type { PickedFood } from '~/types/nutrition'
import NutritionFoodPicker from '~/components/nutrition/NutritionFoodPicker.vue'

withDefaults(defineProps<{ title?: string, multiple?: boolean }>(), { title: 'Add foods', multiple: true })
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [picked: PickedFood[]] }>()

const picked = ref<PickedFood[]>([])
watch(open, (value) => {
  if (value) picked.value = []
})

const picker = ref<InstanceType<typeof NutritionFoodPicker>>()

function confirm() {
  emit('confirm', picked.value)
  open.value = false
}
</script>

<template>
  <NutritionSheet v-model:open="open" :title="title" fullscreen>
    <template #body>
      <NutritionFoodPicker ref="picker" v-model="picked" :multiple="multiple" />
    </template>
    <template #footer>
      <UButton
        block
        :label="picked.length ? `Add ${picked.length}` : 'Add'"
        :disabled="picked.length === 0 || picker?.pending"
        data-test="picker-confirm"
        @click="confirm"
      />
    </template>
  </NutritionSheet>
</template>
