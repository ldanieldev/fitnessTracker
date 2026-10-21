<script setup lang="ts">
import * as Sentry from '@sentry/nuxt'
import { decodeBarcode, isSupportedBarcodeFormat, normalizeGtin } from '~/utils/barcode/decode'
import { errorMessage } from '~/utils/apiError'

const props = withDefaults(defineProps<{ fallback?: string }>(), { fallback: 'use manual entry below' })
const emit = defineEmits<{ detected: [code: string] }>()

const DETECTOR_FORMAT_MAP: Record<string, string> = {
  ean_13: 'EAN-13',
  ean_8: 'EAN-8',
  upc_a: 'UPC-A',
  upc_e: 'UPC-E'
}

const FRAME_INTERVAL_MS = 250

const toast = useToast()

const secure = ref<boolean | null>(null)
const permissionError = ref<string | null>(null)
const videoEl = useTemplateRef('videoEl')

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

function handleHit(rawText: string) {
  if (stopped) return
  let code: string
  try {
    code = normalizeGtin(rawText)
  } catch (err: unknown) {
    toast.add({
      title: 'Invalid barcode',
      description: errorMessage(err, 'Could not read this barcode'),
      color: 'error'
    })
    return
  }
  stopScanning()
  emit('detected', code)
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
      if (hit && format && isSupportedBarcodeFormat(format)) handleHit(hit.rawValue)
    } else {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const hit = await decodeBarcode(imageData)
      if (hit && isSupportedBarcodeFormat(hit.format)) handleHit(hit.text)
    }
  } catch (err: unknown) {
    warnScannerFailure('detect', err)
    cameraFailed(`Barcode scanning stopped — ${props.fallback}`)
  } finally {
    processingFrame = false
  }
}

function cameraFailed(message = `Camera unavailable — ${props.fallback}`) {
  stopScanning()
  if (!unmounted && !permissionError.value) permissionError.value = message
}

const cancelled = () => unmounted || stopped

function warnScannerFailure(stage: 'start' | 'detect', err: unknown) {
  const name = errorName(err)
  if (name !== 'NotAllowedError') Sentry.logger.warn('Barcode scanner failed', { stage, errorName: name })
}

async function startCamera() {
  let media: MediaStream
  try {
    media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  } catch (err: unknown) {
    const name = typeof err === 'object' && err !== null && 'name' in err ? (err as { name: unknown }).name : undefined
    permissionError.value =
      name === 'NotAllowedError'
        ? `Camera permission was denied — grant camera permission or ${props.fallback}`
        : `Camera unavailable — ${props.fallback}`
    return
  }
  if (cancelled()) {
    for (const track of media.getTracks()) track.stop()
    return
  }
  stream = media
  try {
    await nextTick()
    const video = videoEl.value
    if (cancelled() || !video) return stopScanning()
    video.srcObject = stream
    await video.play()
    if (cancelled()) return stopScanning()
    await setupDetector()
    if (cancelled()) return stopScanning()
    frameTimer = setInterval(captureFrame, FRAME_INTERVAL_MS)
  } catch (err: unknown) {
    if (cancelled()) return stopScanning()
    warnScannerFailure('start', err)
    cameraFailed()
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
  <UAlert
    v-if="secure === false"
    color="warning"
    variant="soft"
    title="Camera scanning requires HTTPS"
    :description="`Open this page over HTTPS to use the camera, or ${fallback}.`"
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
</template>
