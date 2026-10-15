<script setup lang="ts">
const today = useTodayOrNow()
const modules = useModules()
const exportDescription =
  'Everything you\'ve logged, in one JSON file: profile, body, steps, day notes, nutrition and workouts.'
const fitnotesDescription =
  'Upload a FitNotes CSV export to bring your training history in. Review how its exercises map first.'
const tokensDescription = 'Let a script or an AI assistant read and update your data over the API.'
</script>

<template>
  <div class="flex flex-col gap-8 lg:gap-12">
    <section class="flex flex-col gap-3" aria-labelledby="data-export-heading">
      <h2 id="data-export-heading" class="text-xs font-medium text-dimmed uppercase">Export</h2>
      <UPageCard
        title="Export your data"
        :description="exportDescription"
        variant="subtle"
      >
        <div class="flex flex-col gap-3">
          <p class="text-sm text-muted">
            Keep a copy somewhere safe. Rows keep their ids, so references between them still line up, and the shared
            exercises and foods your entries point at are included by name.
          </p>
          <UButton
            label="Download all data"
            icon="i-lucide-download"
            :href="`/api/export?today=${today}`"
            external
            download
            class="self-start"
            data-test="export-download"
          />
        </div>
      </UPageCard>
    </section>

    <section
      v-if="modules.workouts.value || modules.nutrition.value"
      class="flex flex-col gap-3"
      aria-labelledby="data-import-heading"
      data-test="data-import"
    >
      <h2 id="data-import-heading" class="text-xs font-medium text-dimmed uppercase">Import</h2>
      <div class="flex flex-col gap-4 sm:gap-6">
        <UPageCard
          v-if="modules.workouts.value"
          title="Import from FitNotes"
          :description="fitnotesDescription"
          variant="subtle"
          :ui="{ container: 'min-w-0' }"
          data-test="import-fitnotes-card"
        >
          <SettingsWorkoutFitNotesImport />
        </UPageCard>
        <UPageCard
          v-if="modules.nutrition.value"
          title="Import from My Macros+"
          description="Upload daily export .txt files to bring your logged meals into the diary."
          variant="subtle"
          :ui="{ container: 'min-w-0' }"
          data-test="import-mymacros-card"
        >
          <SettingsNutritionImport />
        </UPageCard>
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="data-tokens-heading" data-test="data-tokens">
      <h2 id="data-tokens-heading" class="text-xs font-medium text-dimmed uppercase">Access tokens</h2>
      <UPageCard
        title="Personal access tokens"
        :description="tokensDescription"
        variant="subtle"
        :ui="{ container: 'min-w-0' }"
      >
        <SettingsAccessTokens />
      </UPageCard>
    </section>
  </div>
</template>
