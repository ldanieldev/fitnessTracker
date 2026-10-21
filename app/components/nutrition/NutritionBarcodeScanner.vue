<script setup lang="ts">
import type { ExternalFood } from '~/composables/useBarcodeLookup'
import { normalizeGtin } from '~/utils/barcode/decode'
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{
  date: string
  containerId?: number
}>()

const containerQuery = computed(() => (props.containerId !== undefined ? `&containerId=${props.containerId}` : ''))

const SOURCE_LABELS: Record<ExternalFood['source'], string> = {
  off: 'Open Food Facts',
  usda: 'USDA',
  fatsecret: 'FatSecret'
}

const toast = useToast()
const { lookup } = useBarcodeLookup()

const manualCode = ref('')
const external = ref<ExternalFood | null>(null)
const importing = ref(false)

let unmounted = false

async function lookUpCode(code: string) {
  try {
    const result = await lookup(code)
    if (unmounted) return
    if (result.kind === 'local') {
      await navigateTo(`/nutrition/diary/${props.date}/add?foodId=${result.foodId}${containerQuery.value}`, {
        replace: true
      })
    } else if (result.kind === 'external') {
      external.value = result.external
    } else {
      if (result.errors.length > 0) toast.add({ title: 'Barcode sources unavailable', color: 'warning' })
      await navigateTo(`/nutrition/diary/${props.date}/foods/new?barcode=${code}${containerQuery.value}`, {
        replace: true
      })
    }
  } catch (err: unknown) {
    reportFailure(err, 'Barcode lookup')
    if (!unmounted)
      toast.add({
        title: 'Lookup failed',
        description: errorMessage(err, 'Could not look up this barcode'),
        color: 'error'
      })
  }
}

async function submitManual() {
  const trimmed = manualCode.value.trim()
  if (!trimmed) return
  let code: string
  try {
    code = normalizeGtin(trimmed)
  } catch (err: unknown) {
    toast.add({
      title: 'Invalid barcode',
      description: errorMessage(err, 'Could not read this barcode'),
      color: 'error'
    })
    return
  }
  await lookUpCode(code)
}

async function importExternal() {
  if (!external.value) return
  importing.value = true
  try {
    const imported = await apiFetch<{ id: number; needsNutrition: boolean; owned: boolean }>(
      '/api/nutrition/foods/import',
      {
        method: 'POST',
        body: { source: external.value.source, externalId: external.value.externalId }
      }
    )
    await invalidateNutrition(NUTRITION_KEYS.foods)
    if (unmounted) return
    const suffix = imported.needsNutrition ? '&needsNutrition=1' : ''
    await navigateTo(`/nutrition/diary/${props.date}/add?foodId=${imported.id}${suffix}${containerQuery.value}`, {
      replace: true
    })
  } catch (err: unknown) {
    reportFailure(err, 'Import barcode food')
    if (!unmounted)
      toast.add({
        title: 'Import failed',
        description: errorMessage(err, 'Could not import this food'),
        color: 'error'
      })
  } finally {
    importing.value = false
  }
}

onUnmounted(() => {
  unmounted = true
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <NutritionBarcodeCamera @detected="lookUpCode" />

    <UCard v-if="external" data-test="scan-external-card">
      <div class="flex items-center gap-2">
        <UBadge :label="SOURCE_LABELS[external.source]" color="neutral" variant="subtle" />
        <div class="flex flex-col flex-1">
          <span class="font-medium">{{ external.name }}</span>
          <span v-if="external.brand" class="text-dimmed text-sm">{{ external.brand }}</span>
          <span v-if="external.attribution" class="text-dimmed text-xs">{{ external.attribution }}</span>
        </div>
        <UButton
          label="Import"
          :loading="importing"
          :aria-label="`Import ${external.name}`"
          data-test="scan-import"
          @click="importExternal"
        />
      </div>
    </UCard>

    <div class="sticky bottom-0 bg-default pt-2 pb-[env(safe-area-inset-bottom)]">
      <UFormField label="Barcode">
        <div class="flex gap-2">
          <UInput
            v-model="manualCode"
            placeholder="Enter barcode manually"
            class="flex-1"
            data-test="scan-manual-input"
            @keyup.enter="submitManual"
          />
          <UButton label="Look up" class="shrink-0" data-test="scan-manual-submit" @click="submitManual" />
        </div>
      </UFormField>
    </div>
  </div>
</template>
