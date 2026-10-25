<script setup lang="ts">
import * as Sentry from '@sentry/nuxt'
import { type CameraProbe, focusesClose, nextCamera, pickScanCamera } from '~/utils/barcode/camera'
import { type BarcodePoint, decodeBarcode, isSupportedBarcodeFormat, normalizeGtin } from '~/utils/barcode/decode'
import { type Crop, FRAME, frameCrop } from '~/utils/barcode/viewfinder'
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
const frameStyle = { width: `${FRAME.width * 100}%`, height: `${FRAME.height * 100}%` }
const CAMERA_STORAGE_KEY = 'nutrition.barcode.camera'

type FocusCapabilities = MediaTrackCapabilities & { focusDistance?: { min?: number } }

const toast = useToast()

const secure = ref<boolean | null>(null)
const permissionError = ref<string | null>(null)
const cameraIds = ref<string[]>([])
const switching = ref(false)
const detected = ref(false)
const outline = ref<{ viewBox: string; points: string } | null>(null)
const videoEl = useTemplateRef('videoEl')

let stream: MediaStream | null = null
let deviceId: string | undefined
const frontCameras = new Set<string>()
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

function ensureCanvas(video: HTMLVideoElement): { context: CanvasRenderingContext2D; crop: Crop } | null {
  if (!video.videoWidth || !video.videoHeight) return null
  const crop = frameCrop(
    { width: video.videoWidth, height: video.videoHeight },
    { width: video.clientWidth, height: video.clientHeight }
  )
  if (!canvas) canvas = document.createElement('canvas')
  if (canvas.width !== crop.width || canvas.height !== crop.height) {
    canvas.width = crop.width
    canvas.height = crop.height
  }
  if (!canvasContext) canvasContext = canvas.getContext('2d')
  return canvasContext ? { context: canvasContext, crop } : null
}

async function setupDetector() {
  if (!('BarcodeDetector' in window) || !window.BarcodeDetector) return
  const formats = await window.BarcodeDetector.getSupportedFormats()
  if (formats.includes('ean_13')) {
    detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
  }
}

function showOutline(corners: readonly BarcodePoint[], crop: Crop) {
  const video = videoEl.value
  if (!video || corners.length < 3) return
  outline.value = {
    viewBox: `0 0 ${video.videoWidth} ${video.videoHeight}`,
    points: corners.map((p) => `${crop.x + p.x},${crop.y + p.y}`).join(' ')
  }
}

function handleHit(rawText: string, corners: readonly BarcodePoint[], crop: Crop) {
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
  showOutline(corners, crop)
  videoEl.value?.pause()
  stopScanning()
  detected.value = true
  emit('detected', code)
}

async function captureFrame() {
  const video = videoEl.value
  if (!video || processingFrame) return
  const target = ensureCanvas(video)
  if (!target || !canvas) return
  const { context, crop } = target
  processingFrame = true
  try {
    context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
    if (detector) {
      const hits = await detector.detect(canvas)
      const hit = hits[0]
      const format = hit ? DETECTOR_FORMAT_MAP[hit.format] : undefined
      if (hit && format && isSupportedBarcodeFormat(format)) handleHit(hit.rawValue, hit.cornerPoints ?? [], crop)
    } else {
      const imageData = context.getImageData(0, 0, crop.width, crop.height)
      const hit = await decodeBarcode(imageData)
      if (hit && isSupportedBarcodeFormat(hit.format)) handleHit(hit.text, hit.corners, crop)
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

// InputDeviceInfo.getCapabilities is Chromium-only; elsewhere a front camera is known only once it has been opened.
function isFrontCamera(device: MediaDeviceInfo): boolean {
  if (frontCameras.has(device.deviceId)) return true
  const facing = (device as Partial<InputDeviceInfo>).getCapabilities?.().facingMode
  return facing?.includes('user') === true && !facing.includes('environment')
}

async function listCameras(): Promise<string[]> {
  const devices = (await navigator.mediaDevices.enumerateDevices?.()) ?? []
  return devices.filter((d) => d.kind === 'videoinput' && d.deviceId && !isFrontCamera(d)).map((d) => d.deviceId)
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
      if (facing === 'user') frontCameras.add(id)
      const minFocusM = facing === undefined || facing === 'environment' ? minFocusOf(track) : undefined
      stopMedia(media)
      probes.push({ deviceId: id, minFocusM })
    } catch {
      // a camera that will not open just drops out of the candidates
    }
  }
  return probes
}

async function acquireStream(preferred: string | undefined): Promise<MediaStream> {
  if (preferred) {
    try {
      const media = await openCamera(preferred)
      deviceId = preferred
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

const onFrontCamera = () => deviceId !== undefined && frontCameras.has(deviceId)

async function switchCamera() {
  if (switching.value) return
  switching.value = true
  const ids = cameraIds.value
  let id = deviceId
  try {
    for (let tries = 0; tries < ids.length; tries++) {
      id = nextCamera(ids, id)
      if (!id) break
      stopScanning()
      stopped = false
      await startCamera(id)
      if (cancelled() || !onFrontCamera()) break
    }
    if (!cancelled() && deviceId && !onFrontCamera()) storeCamera(deviceId)
  } finally {
    switching.value = false
  }
}

async function scanAgain() {
  detected.value = false
  outline.value = null
  stopped = false
  await startCamera(deviceId)
}

async function startCamera(preferred = readStoredCamera()) {
  let media: MediaStream
  try {
    media = await acquireStream(preferred)
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
  if (deviceId && media.getTracks()[0]?.getSettings?.().facingMode === 'user') frontCameras.add(deviceId)
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
  <div v-else-if="secure" class="relative overflow-hidden rounded-lg">
    <video
      ref="videoEl"
      class="w-full bg-black aspect-video object-cover"
      muted
      playsinline
      aria-label="Barcode viewfinder"
      data-test="scan-video"
    />
    <div
      v-if="!detected"
      class="pointer-events-none absolute inset-0 flex items-center justify-center"
      data-test="scan-frame"
    >
      <div class="relative rounded-sm shadow-[0_0_0_100vmax_rgb(0_0_0/0.4)]" :style="frameStyle">
        <div
          class="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-red-600 animate-laser motion-reduce:animate-none"
        />
      </div>
    </div>
    <svg
      v-if="outline"
      class="pointer-events-none absolute inset-0 size-full text-success"
      :viewBox="outline.viewBox"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-test="scan-outline"
    >
      <polygon
        :points="outline.points"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <UButton
      v-if="detected"
      icon="i-lucide-scan-barcode"
      label="Scan again"
      class="absolute bottom-2 left-1/2 -translate-x-1/2"
      data-test="scan-again"
      @click="scanAgain"
    />
    <UButton
      v-else-if="cameraIds.length > 1"
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
