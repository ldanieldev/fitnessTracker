<script setup lang="ts">
const today = useTodayOrNow()
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12">
    <UPageCard
      title="Export your data"
      description="Everything you've logged, in one JSON file: profile, body, steps, day notes, nutrition and workouts."
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
  </div>
</template>
