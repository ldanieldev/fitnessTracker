<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'
import { splitByExtension } from '~/utils/fileExtension'
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

const LOST_MESSAGE = 'It may still be running. Reload this page later before importing these files again.'

const toast = useToast()

const selectedFiles = ref<File[]>([])
const uploading = ref(false)
const status = ref<ImportJob['status'] | null>(null)
const result = ref<ImportResult | null>(null)
const jobError = ref<string | null>(null)
const lost = ref(false)
const poller = useJobPoll<ImportJob>()

// UFileUpload appends each drop to the list, so a re-dropped file would otherwise be uploaded twice.
const files = computed({
  get: () => selectedFiles.value,
  set: (picked: File[] | null | undefined) => {
    const { kept, skipped } = splitByExtension(picked ?? [], '.txt')
    if (skipped.length) {
      toast.add({
        title: 'Only .txt files can be imported',
        description: `Skipped ${skipped.map((file) => file.name).join(', ')}`,
        color: 'warning'
      })
    }
    selectedFiles.value = [...new Map(kept.map((file) => [file.name, file])).values()]
  }
})

function poll(jobId: number) {
  poller.start(`/api/nutrition/import/mymacros/${jobId}`, {
    onJob: async (job) => {
      status.value = job.status
      if (job.status !== 'done' && job.status !== 'failed') return false
      result.value = job.result
      jobError.value = job.error
      uploading.value = false
      if (job.status === 'done') {
        await invalidateNutrition(
          NUTRITION_KEYS.foods,
          NUTRITION_KEYS.containers,
          NUTRITION_KEYS.containersAll,
          'nutrition:day:',
          'nutrition:logged:'
        )
        emit('imported')
      }
      return true
    },
    onGiveUp: (error, mayBeRunning) => {
      uploading.value = false
      lost.value = mayBeRunning
      toast.add({
        title: mayBeRunning ? 'Lost track of the import' : 'Import failed',
        description: mayBeRunning ? LOST_MESSAGE : errorMessage(error, 'Import failed'),
        color: 'error'
      })
    }
  })
}

async function submit() {
  if (!selectedFiles.value.length || uploading.value || lost.value) return
  uploading.value = true
  status.value = null
  result.value = null
  jobError.value = null

  const formData = new FormData()
  for (const file of selectedFiles.value) formData.append('files', file, file.name)
  // The export has dates but no times, so the server logs each entry at noon in this zone.
  formData.append('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone)

  try {
    const { jobId } = await apiFetch<{ jobId: number }>('/api/nutrition/import/mymacros', {
      method: 'POST',
      body: formData
    })
    status.value = 'queued'
    poll(jobId)
  } catch (error: unknown) {
    uploading.value = false
    const failedJobId = (error as { data?: { data?: { jobId?: number } } })?.data?.data?.jobId
    reportFailure(error, 'Import failed')
    toast.add({
      title: 'Import failed',
      description: failedJobId
        ? `${errorMessage(error, 'Import failed')} (job #${failedJobId})`
        : errorMessage(error, 'Import failed'),
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="flex w-full min-w-0 flex-col gap-4">
    <UFormField label="My Macros+ daily export files (.txt)" name="files">
      <UFileUpload
        v-model="files"
        multiple
        accept=".txt"
        layout="list"
        label="Drop .txt files here"
        description="or tap to choose — add as many days as you like"
        :file-image="false"
        file-icon="i-lucide-file-text"
        :disabled="uploading"
        class="w-full"
        data-test="import-files"
      />
    </UFormField>

    <UButton
      label="Import"
      aria-label="Import"
      data-test="import-submit"
      class="self-start"
      :loading="uploading"
      :disabled="uploading || lost || !selectedFiles.length"
      @click="submit"
    />

    <p v-if="lost" data-test="import-lost" class="text-sm text-warning">Lost track of the import. {{ LOST_MESSAGE }}</p>

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

    <UAlert
      v-else-if="status === 'failed' && jobError"
      color="error"
      variant="subtle"
      title="Import failed"
      :description="jobError"
    />
  </div>
</template>
