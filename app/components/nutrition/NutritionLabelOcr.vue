<script setup lang="ts">
import type { NutrientKey } from '~~/shared/types/nutrition'
import { parseNutritionLabel } from '~/utils/ocr/labelParser'
import { loadImageToCanvas, preprocessForOcr } from '~/utils/ocr/preprocess'

interface ParsedLabel {
  servingGrams: number | null
  nutrients: Partial<Record<NutrientKey, number>>
  confidence: number
}

const emit = defineEmits<{
  parsed: [result: ParsedLabel]
}>()

const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  energy: 'Energy (kcal)',
  protein: 'Protein (g)',
  carbohydrate: 'Carbohydrate (g)',
  fat: 'Fat (g)',
  fiber: 'Fiber (g)',
  sugar: 'Sugar (g)',
  saturatedFat: 'Saturated fat (g)',
  cholesterol: 'Cholesterol (mg)',
  sodium: 'Sodium (mg)',
  potassium: 'Potassium (mg)'
}

const nutrientKeys = Object.keys(NUTRIENT_LABELS) as NutrientKey[]

const status = ref<'idle' | 'recognizing' | 'done' | 'error'>('idle')
const rawText = ref('')
const parsed = ref<ParsedLabel | null>(null)
const errorText = ref('')

const statusText = computed(() => {
  if (status.value === 'recognizing') return 'Reading label…'
  if (status.value === 'error') return errorText.value
  if (status.value === 'done') return 'Label read — review the fields below'
  return 'Choose a photo of a nutrition label'
})

type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js').createWorker>>

const worker = shallowRef<TesseractWorker | undefined>()
let unmounted = false

async function terminateWorker() {
  const current = worker.value
  if (!current) return
  worker.value = undefined
  await current.terminate()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  status.value = 'recognizing'
  errorText.value = ''
  parsed.value = null
  rawText.value = ''
  try {
    const canvas = await loadImageToCanvas(file)
    preprocessForOcr(canvas)
    const { createWorker } = await import('tesseract.js')
    worker.value = await createWorker('eng', undefined, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/tesseract-core-lstm.wasm.js',
      langPath: '/ocr/'
    })
    const { data } = await worker.value.recognize(canvas)
    if (unmounted) return
    rawText.value = data.text
    parsed.value = parseNutritionLabel(data.text)
    status.value = 'done'
  } catch (err: unknown) {
    if (!unmounted) {
      status.value = 'error'
      errorText.value = err instanceof Error ? err.message : 'Could not read this label'
    }
  } finally {
    await terminateWorker()
    input.value = ''
  }
}

function apply() {
  if (!parsed.value) return
  emit('parsed', parsed.value)
}

onUnmounted(() => {
  unmounted = true
  void terminateWorker()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <UFormField label="Label photo">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Scan nutrition label photo"
        data-test="ocr-file"
        @change="handleFileChange"
      >
    </UFormField>

    <p data-test="ocr-status" class="text-sm text-dimmed">{{ statusText }}</p>

    <div v-if="parsed" class="flex flex-col gap-2" data-test="ocr-fields">
      <p v-if="parsed.servingGrams !== null" class="text-sm">Serving: {{ parsed.servingGrams }} g</p>
      <ul class="list-none p-0 m-0 grid grid-cols-2 gap-1 text-sm">
        <li v-for="key in nutrientKeys" :key="key">
          <span class="text-dimmed">{{ NUTRIENT_LABELS[key] }}:</span> {{ parsed.nutrients[key] ?? '—' }}
        </li>
      </ul>
      <p class="text-xs text-dimmed">Confidence: {{ Math.round(parsed.confidence * 100) }}%</p>
      <UButton label="Apply to form" data-test="ocr-apply" @click="apply" />
    </div>

    <details v-if="rawText">
      <summary class="text-xs text-dimmed cursor-pointer">Raw text</summary>
      <pre class="text-xs text-dimmed whitespace-pre-wrap" data-test="ocr-raw">{{ rawText }}</pre>
    </details>
  </div>
</template>
