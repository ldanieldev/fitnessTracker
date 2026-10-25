<script setup lang="ts">
import * as Sentry from '@sentry/nuxt'
import { type CameraProbe, focusesClose, nextCamera, pickScanCamera } from '~/utils/barcode/camera'
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
const CAMERA_STORAGE_KEY = 'nutrition.barcode.camera'

type FocusCapabilities = MediaTrackCapabilities & { focusDistance?: { min?: number } }

const toast = useToast()

const secure = ref<boolean | null>(null)
const permissionError = ref<string | null>(null)
const cameraIds = ref<string[]>([])
const switching = ref(false)
const videoEl = useTemplateRef('videoEl')

let stream: MediaStream | null = null
let deviceId: string | undefined
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
    stopMedia(stream)
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

function readStoredCamera(): string | undefined {
  try {
    return localStorage.getItem(CAMERA_STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function storeCamera(id: string) {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, id)
  } catch {
    // best-effort — private browsing or disabled storage should not break scanning
  }
}

function openCamera(id?: string): Promise<MediaStream> {
  const video: MediaTrackConstraints = id ? { deviceId: { exact: id } } : { facingMode: 'environment' }
  return navigator.mediaDevices.getUserMedia({ video })
}

function stopMedia(media: MediaStream) {
  for (const track of media.getTracks()) track.stop()
}

function minFocusOf(track: MediaStreamTrack | undefined): number | undefined {
  return (track?.getCapabilities?.() as FocusCapabilities | undefined)?.focusDistance?.min
}

async function listCameras(): Promise<string[]> {
  const devices = (await navigator.mediaDevices.enumerateDevices?.()) ?? []
  return devices.filter((d) => d.kind === 'videoinput' && d.deviceId).map((d) => d.deviceId)
}

// Probed one at a time because many phones refuse to open a second camera while one is streaming.
async function probeBackCameras(ids: string[], skip: string | undefined): Promise<CameraProbe[]> {
  const probes: CameraProbe[] = []
  for (const id of ids) {
    if (id === skip || cancelled()) continue
    try {
      const media = await openCamera(id)
      const track = media.getTracks()[0]
      const facing = track?.getSettings?.().facingMode
      const minFocusM = facing === undefined || facing === 'environment' ? minFocusOf(track) : undefined
      stopMedia(media)
      probes.push({ deviceId: id, minFocusM })
    } catch {
      // a camera that will not open just drops out of the candidates
    }
  }
  return probes
}

async function acquireStream(): Promise<MediaStream> {
  const stored = readStoredCamera()
  if (stored) {
    try {
      const media = await openCamera(stored)
      deviceId = stored
      return media
    } catch {
      // remembered camera is gone (new device, rotated id) — fall back to the automatic pick
    }
  }
  const media = await openCamera()
  const track = media.getTracks()[0]
  deviceId = track?.getSettings?.().deviceId
  if (focusesClose(minFocusOf(track)) || cancelled()) return media
  stopMedia(media)
  const probes = await probeBackCameras(await listCameras(), deviceId)
  if (cancelled()) return media
  const better = pickScanCamera(probes)
  if (!better) return openCamera()
  deviceId = better
  storeCamera(better)
  return openCamera(better)
}

async function switchCamera() {
  const id = nextCamera(cameraIds.value, deviceId)
  if (!id || switching.value) return
  switching.value = true
  storeCamera(id)
  stopScanning()
  stopped = false
  try {
    await startCamera()
  } finally {
    switching.value = false
  }
}

async function startCamera() {
  let media: MediaStream
  try {
    media = await acquireStream()
  } catch (err: unknown) {
    const name = typeof err === 'object' && err !== null && 'name' in err ? (err as { name: unknown }).name : undefined
    permissionError.value =
      name === 'NotAllowedError'
        ? `Camera permission was denied — grant camera permission or ${props.fallback}`
        : `Camera unavailable — ${props.fallback}`
    return
  }
  if (cancelled()) {
    stopMedia(media)
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
    if (!detector) await setupDetector()
    if (cancelled()) return stopScanning()
    frameTimer = setInterval(captureFrame, FRAME_INTERVAL_MS)
    cameraIds.value = await listCameras()
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
  <div v-else-if="secure" class="relative">
    <video
      ref="videoEl"
      class="w-full rounded-lg bg-black aspect-video"
      muted
      playsinline
      aria-label="Barcode viewfinder"
      data-test="scan-video"
    />
    <UButton
      v-if="cameraIds.length > 1"
      icon="i-lucide-switch-camera"
      color="neutral"
      variant="soft"
      size="sm"
      class="absolute top-2 right-2"
      aria-label="Switch camera"
      :loading="switching"
      data-test="scan-switch-camera"
      @click="switchCamera"
    />
  </div>
</template>
