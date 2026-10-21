<script setup lang="ts">
defineProps<{ inputTest: string }>()
const model = defineModel<string>({ required: true })

const scanning = ref(false)

function applyCode(code: string) {
  model.value = code
  scanning.value = false
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <UFormField label="Barcode">
      <div class="flex gap-2">
        <UInput v-model="model" inputmode="numeric" class="flex-1" :data-test="inputTest" />
        <UButton
          icon="i-lucide-scan-barcode"
          :aria-label="scanning ? 'Close barcode scanner' : 'Scan barcode'"
          variant="soft"
          color="neutral"
          class="shrink-0"
          :data-test="`${inputTest}-scan`"
          @click="scanning = !scanning"
        />
      </div>
    </UFormField>
    <NutritionBarcodeCamera v-if="scanning" fallback="type the barcode above" @detected="applyCode" />
  </div>
</template>
