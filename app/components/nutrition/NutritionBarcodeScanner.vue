<script setup lang="ts">
import type { ExternalFood } from '~/composables/useBarcodeLookup'
import { decodeBarcode, isSupportedBarcodeFormat, normalizeGtin } from '~/utils/barcode/decode'
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{
  date: string
}>()

const SOURCE_LABELS: Record<ExternalFood['source'], string> = {
  off: 'Open Food Facts',
  usda: 'USDA',
  fatsecret: 'FatSecret'
}

const DETECTOR_FORMAT_MAP: Record<string, string> = {
  ean_13: 'EAN-13',
  ean_8: 'EAN-8',
  upc_a: 'UPC-A',
  upc_e: 'UPC-E'
}

const FRAME_INTERVAL_MS = 250

const toast = useToast()
const { lookup } = useBarcodeLookup()

const secure = ref<boolean | null>(null)
const permissionError = ref<string | null>(null)
const manualCode = ref('')
const videoEl = useTemplateRef('videoEl')
const external = ref<ExternalFood | null>(null)
const importing = ref(false)

let stream: MediaStream | null = null
let frameTimer: ReturnType<typeof setInterval> | null = null
let canvas: HTMLCanvasElement | null = null
let canvasContext: CanvasRenderingContext2D | null = null
let detector: BarcodeDetector | null = null
let stopped = false
let unmounted = false
let processingFrame = false

function stopScanning() {
  stopped = true
  if (frameTimer !== null) {
    clearInterval(frameTimer)
    frameTimer = null
  }
  if (stream) {
    for (const track of stream.getTracks()) track.stop()
    stream = null
  }
}

function ensureCanvas(video: HTMLVideoElement): CanvasRenderingContext2D | null {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) return null
  if (!canvas) canvas = document.createElement('canvas')
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  if (!canvasContext) canvasContext = canvas.getContext('2d')
  return canvasContext
}

async function setupDetector() {
  if (!('BarcodeDetector' in window) || !window.BarcodeDetector) return
  const formats = await window.BarcodeDetector.getSupportedFormats()
  if (formats.includes('ean_13')) {
    detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
  }
}

async function handleHit(rawText: string) {
  if (stopped) return
  let code: string
  try {
    code = normalizeGtin(rawText)
  } catch (err: unknown) {
    toast.add({ title: 'Invalid barcode', description: errorMessage(err, 'Could not read this barcode'), color: 'error' })
    return
  }
  stopScanning()
  try {
    const result = await lookup(code)
    if (unmounted) return
    if (result.kind === 'local') {
      await navigateTo(`/diary/${props.date}/add?foodId=${result.foodId}`)
    } else if (result.kind === 'external') {
      external.value = result.external
    } else {
      if (result.errors.length > 0) toast.add({ title: 'Barcode sources unavailable', color: 'warning' })
      await navigateTo(`/diary/${props.date}/foods/new?barcode=${code}`)
    }
  } catch (err: unknown) {
    if (!unmounted) toast.add({ title: 'Lookup failed', description: errorMessage(err, 'Could not look up this barcode'), color: 'error' })
  }
}

async function captureFrame() {
  const video = videoEl.value
  if (!video || processingFrame) return
  const context = ensureCanvas(video)
  if (!context || !canvas) return
  processingFrame = true
  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    if (detector) {
      const hits = await detector.detect(canvas)
      const hit = hits[0]
      const format = hit ? DETECTOR_FORMAT_MAP[hit.format] : undefined
      if (hit && format && isSupportedBarcodeFormat(format)) await handleHit(hit.rawValue)
    } else {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const hit = await decodeBarcode(imageData)
      if (hit && isSupportedBarcodeFormat(hit.format)) await handleHit(hit.text)
    }
  } finally {
    processingFrame = false
  }
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  } catch (err: unknown) {
    const name = typeof err === 'object' && err !== null && 'name' in err ? (err as { name: unknown }).name : undefined
    permissionError.value = name === 'NotAllowedError'
      ? 'Camera permission was denied — grant camera permission or use manual entry below'
      : 'Camera unavailable — use manual entry below'
    return
  }
  await nextTick()
  const video = videoEl.value
  if (!video) return
  video.srcObject = stream
  await video.play()
  await setupDetector()
  frameTimer = setInterval(captureFrame, FRAME_INTERVAL_MS)
}

async function submitManual() {
  const trimmed = manualCode.value.trim()
  if (!trimmed) return
  // The camera loop's stop-after-first-hit latch would otherwise silently no-op a second manual lookup.
  stopped = false
  await handleHit(trimmed)
}

async function importExternal() {
  if (!external.value) return
  importing.value = true
  try {
    const imported = await $fetch<{ id: number, needsNutrition: boolean, owned: boolean }>('/api/nutrition/foods/import', {
      method: 'POST',
      body: { source: external.value.source, externalId: external.value.externalId }
    })
    if (unmounted) return
    const suffix = imported.needsNutrition ? '&needsNutrition=1' : ''
    await navigateTo(`/diary/${props.date}/add?foodId=${imported.id}${suffix}`)
  } catch (err: unknown) {
    if (!unmounted) toast.add({ title: 'Import failed', description: errorMessage(err, 'Could not import this food'), color: 'error' })
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  secure.value = window.isSecureContext
  if (secure.value) await startCamera()
})

onUnmounted(() => {
  unmounted = true
  stopScanning()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <UAlert
      v-if="secure === false"
      color="warning"
      variant="soft"
      title="Camera scanning requires HTTPS"
      description="Open this page over HTTPS to use the camera, or enter the barcode manually below."
      data-test="scan-https-notice"
    />
    <UAlert
      v-else-if="permissionError"
      color="warning"
      variant="soft"
      :title="permissionError"
      data-test="scan-permission-notice"
    />
    <video
      v-else-if="secure"
      ref="videoEl"
      class="w-full rounded-lg bg-black aspect-video"
      muted
      playsinline
      aria-label="Barcode viewfinder"
      data-test="scan-video"
    />

    <UCard v-if="external" data-test="scan-external-card">
      <div class="flex items-center gap-2">
        <UBadge :label="SOURCE_LABELS[external.source]" color="neutral" variant="subtle" />
        <div class="flex flex-col flex-1">
          <span class="font-medium">{{ external.name }}</span>
          <span v-if="external.brand" class="text-dimmed text-sm">{{ external.brand }}</span>
          <span v-if="external.attribution" class="text-dimmed text-xs">{{ external.attribution }}</span>
        </div>
        <UButton label="Import" :loading="importing" :aria-label="`Import ${external.name}`" data-test="scan-import" @click="importExternal" />
      </div>
    </UCard>

    <UFormField label="Barcode">
      <div class="flex gap-2">
        <UInput
          v-model="manualCode"
          placeholder="Enter barcode manually"
          class="flex-1"
          data-test="scan-manual-input"
          @keyup.enter="submitManual"
        />
        <UButton label="Look up" data-test="scan-manual-submit" @click="submitManual" />
      </div>
    </UFormField>
  </div>
</template>
