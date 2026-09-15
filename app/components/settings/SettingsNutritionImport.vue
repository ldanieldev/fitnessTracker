<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'
import type { ImportResult } from '~~/shared/types/nutrition'

interface ImportJob {
  id: number
  status: 'queued' | 'running' | 'done' | 'failed'
  fileCount: number
  result: ImportResult | null
  error: string | null
  createdAt: string
}

const emit = defineEmits<{ imported: [] }>()

const toast = useToast()

const selectedFiles = ref<File[]>([])
const uploading = ref(false)
const status = ref<ImportJob['status'] | null>(null)
const result = ref<ImportResult | null>(null)
const jobError = ref<string | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | null = null
let unmounted = false

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFiles.value = input.files ? Array.from(input.files) : []
}

function clearPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function poll(jobId: number) {
  pollTimer = setTimeout(async () => {
    try {
      const job = await apiFetch<ImportJob>(`/api/nutrition/import/mymacros/${jobId}`)
      if (unmounted) return
      status.value = job.status
      if (job.status === 'done' || job.status === 'failed') {
        result.value = job.result
        jobError.value = job.error
        uploading.value = false
        if (job.status === 'done') {
          await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.containers, NUTRITION_KEYS.containersAll, 'nutrition:day:', 'nutrition:logged:')
          emit('imported')
        }
      } else {
        poll(jobId)
      }
    } catch (error: unknown) {
      if (unmounted) return
      uploading.value = false
      toast.add({ title: 'Import failed', description: errorMessage(error, 'Import failed'), color: 'error' })
    }
  }, 2000)
}

async function submit() {
  if (!selectedFiles.value.length || uploading.value) return
  uploading.value = true
  status.value = null
  result.value = null
  jobError.value = null

  const formData = new FormData()
  for (const file of selectedFiles.value) formData.append('files', file, file.name)

  try {
    const { jobId } = await apiFetch<{ jobId: number }>('/api/nutrition/import/mymacros', { method: 'POST', body: formData })
    status.value = 'queued'
    poll(jobId)
  } catch (error: unknown) {
    uploading.value = false
    const failedJobId = (error as { data?: { data?: { jobId?: number } } })?.data?.data?.jobId
    toast.add({
      title: 'Import failed',
      description: failedJobId ? `${errorMessage(error, 'Import failed')} (job #${failedJobId})` : errorMessage(error, 'Import failed'),
      color: 'error'
    })
  }
}

onBeforeUnmount(() => {
  unmounted = true
  clearPoll()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <UFormField label="My Macros+ daily export files (.txt)" name="files">
      <input
        type="file"
        multiple
        accept=".txt,text/plain"
        data-test="import-files"
        aria-label="My Macros+ daily export files"
        @change="onFileChange"
      >
    </UFormField>

    <UButton
      label="Import"
      aria-label="Import"
      data-test="import-submit"
      class="self-start"
      :loading="uploading"
      :disabled="uploading || !selectedFiles.length"
      @click="submit"
    />

    <p v-if="status" data-test="import-status" class="text-sm text-dimmed">Status: {{ status }}</p>

    <template v-if="result">
      <p data-test="import-summary" class="text-sm">
        {{ result.days }} days · {{ result.entries }} entries ({{ result.entriesSkipped }} skipped) ·
        {{ result.foodsCreated }} foods created, {{ result.foodsReused }} reused
      </p>

      <ul v-if="result.warnings.length" class="flex flex-col gap-1 text-sm text-dimmed">
        <li v-for="(warning, index) in result.warnings" :key="index" data-test="import-warning">
          {{ warning.date }} — {{ warning.message }}
        </li>
      </ul>

      <UAlert
        v-for="failed in result.failedFiles"
        :key="failed.fileName"
        data-test="import-failed-file"
        color="error"
        variant="subtle"
        :title="failed.fileName"
        :description="failed.error"
      />
    </template>

    <UAlert v-else-if="status === 'failed' && jobError" color="error" variant="subtle" title="Import failed" :description="jobError" />
  </div>
</template>
