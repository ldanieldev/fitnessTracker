<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'

type ExternalSourceKey = 'off' | 'usda' | 'fatsecret'

interface ExternalResult {
  source: ExternalSourceKey
  externalId: string
  name: string
  brand: string | null
  barcode: string | null
  hasNutrition: boolean
  attribution: string | null
}

interface ExternalErrorEntry {
  source: ExternalSourceKey
  kind: 'unconfigured' | 'unavailable' | 'rate_limited' | 'not_found'
  message: string
}

const emit = defineEmits<{
  imported: [payload: { id: number, needsNutrition: boolean }]
}>()

const toast = useToast()

const SOURCE_LABELS: Record<ExternalSourceKey, string> = {
  off: 'Open Food Facts',
  usda: 'USDA',
  fatsecret: 'FatSecret'
}

const sourceItems = [
  { label: 'All sources', value: 'all' },
  { label: 'Open Food Facts', value: 'off' },
  { label: 'USDA', value: 'usda' },
  { label: 'FatSecret', value: 'fatsecret' }
]

const query = ref('')
const source = ref<'all' | ExternalSourceKey>('all')
const results = ref<ExternalResult[]>([])
const errors = ref<ExternalErrorEntry[]>([])
const searching = ref(false)
const searched = ref(false)
const importingKey = ref<string | null>(null)

function resultKey(result: ExternalResult) {
  return `${result.source}:${result.externalId}`
}

function errorReason(kind: ExternalErrorEntry['kind']) {
  if (kind === 'rate_limited') return 'rate limited'
  if (kind === 'unconfigured') return 'not configured'
  return 'temporarily unavailable'
}

function errorText(error: ExternalErrorEntry) {
  return `Search is unavailable for ${SOURCE_LABELS[error.source]}: ${errorReason(error.kind)}`
}

async function search() {
  const trimmed = query.value.trim()
  if (!trimmed) return
  searching.value = true
  try {
    const result = await $fetch<{ results: ExternalResult[], errors: ExternalErrorEntry[] }>(
      '/api/nutrition/foods/search/external',
      { query: { q: trimmed, source: source.value, limit: 25 } }
    )
    results.value = result.results
    errors.value = result.errors
    searched.value = true
  } catch (error: unknown) {
    toast.add({ title: 'Search failed', description: errorMessage(error, 'Could not search external sources'), color: 'error' })
  } finally {
    searching.value = false
  }
}

async function importResult(result: ExternalResult) {
  importingKey.value = resultKey(result)
  try {
    const imported = await $fetch<{ id: number, needsNutrition: boolean, owned: boolean }>('/api/nutrition/foods/import', {
      method: 'POST',
      body: { source: result.source, externalId: result.externalId }
    })
    emit('imported', { id: imported.id, needsNutrition: imported.needsNutrition })
  } catch (error: unknown) {
    toast.add({ title: 'Import failed', description: errorMessage(error, 'Could not import this food'), color: 'error' })
  } finally {
    importingKey.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-end gap-2">
      <UFormField label="Search" class="flex-1">
        <UInput
          v-model="query"
          placeholder="Search external sources"
          icon="i-lucide-search"
          class="w-full"
          data-test="online-query"
          @keyup.enter="search"
        />
      </UFormField>
      <UFormField label="Source">
        <USelect v-model="source" :items="sourceItems" class="w-40" data-test="online-source" />
      </UFormField>
      <UButton label="Search" :loading="searching" :disabled="!query.trim()" data-test="online-search" @click="search" />
    </div>

    <UAlert
      v-for="error in errors"
      :key="error.source"
      color="warning"
      variant="soft"
      :title="errorText(error)"
      data-test="online-error"
    />

    <ul class="flex flex-col gap-2 list-none p-0 m-0">
      <li
        v-for="result in results"
        :key="resultKey(result)"
        class="flex items-center gap-2 p-2 rounded-lg bg-elevated/50"
        data-test="online-result"
      >
        <UBadge :label="SOURCE_LABELS[result.source]" color="neutral" variant="subtle" />
        <div class="flex flex-col flex-1">
          <span class="font-medium">{{ result.name }}</span>
          <span v-if="result.brand" class="text-dimmed text-sm">{{ result.brand }}</span>
          <span v-if="result.attribution" class="text-dimmed text-xs">{{ result.attribution }}</span>
        </div>
        <UBadge v-if="!result.hasNutrition" label="No nutrition data" color="warning" variant="subtle" />
        <UButton
          label="Import"
          size="xs"
          :loading="importingKey === resultKey(result)"
          :aria-label="`Import ${result.name}`"
          data-test="online-import"
          @click="importResult(result)"
        />
      </li>
    </ul>
    <p v-if="searched && results.length === 0" class="text-sm text-dimmed">No results found</p>
  </div>
</template>
