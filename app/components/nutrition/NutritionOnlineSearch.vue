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
  per100g: Record<string, number> | null
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

// An empty per100g object (no facts returned) must not render as a row full of zero macros.
function facts(result: ExternalResult): Record<string, number> | null {
  return result.per100g && Object.keys(result.per100g).length ? result.per100g : null
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
    const result = await apiFetch<{ results: ExternalResult[], errors: ExternalErrorEntry[] }>(
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
    const imported = await apiFetch<{ id: number, needsNutrition: boolean, owned: boolean }>('/api/nutrition/foods/import', {
      method: 'POST',
      body: { source: result.source, externalId: result.externalId }
    })
    await invalidateNutrition(NUTRITION_KEYS.foods)
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
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
      <UFormField label="Source" class="order-first sm:order-none">
        <USelect v-model="source" :items="sourceItems" class="w-full sm:w-40" data-test="online-source" />
      </UFormField>
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
      <UButton
        label="Search"
        class="w-full sm:w-auto"
        :loading="searching"
        :disabled="!query.trim()"
        data-test="online-search"
        @click="search"
      />
    </div>

    <UAlert
      v-for="error in errors"
      :key="error.source"
      color="warning"
      variant="soft"
      :title="errorText(error)"
      data-test="online-error"
    />

    <div class="flex flex-col gap-2">
      <NutritionResultRow
        v-for="result in results"
        :key="resultKey(result)"
        data-test="online-result"
        :title="result.name"
        :subtitle="result.brand"
        :amount-text="facts(result) ? 'per 100 g' : 'No nutrition data'"
        :nutrients="facts(result)"
        :energy="facts(result)?.energy ?? null"
      >
        <template #actions>
          <UBadge :label="SOURCE_LABELS[result.source]" color="neutral" variant="subtle" />
          <UButton
            label="Import"
            size="xs"
            :loading="importingKey === resultKey(result)"
            :aria-label="`Import ${result.name}`"
            data-test="online-import"
            @click="importResult(result)"
          />
        </template>
        <template v-if="result.attribution" #meta>
          <p class="truncate text-xs text-dimmed">{{ result.attribution }}</p>
        </template>
      </NutritionResultRow>
    </div>
    <p v-if="searched && results.length === 0" class="text-sm text-dimmed">No results found</p>
  </div>
</template>
