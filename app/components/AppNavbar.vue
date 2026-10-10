<script setup lang="ts">
const props = defineProps<{ title?: string; back?: string; backToParent?: boolean }>()
const backOrTo = useBackOrTo()
</script>

<template>
  <UDashboardNavbar :title="props.title" :toggle="!props.back">
    <template #leading>
      <UDashboardSidebarCollapse />
      <UButton
        v-if="props.back"
        icon="i-lucide-chevron-left"
        variant="ghost"
        color="neutral"
        class="min-h-10 min-w-10 justify-center"
        aria-label="Back"
        data-test="navbar-back"
        @click="props.backToParent ? navigateTo(props.back) : backOrTo(props.back)"
      />
    </template>
    <template v-if="$slots.title" #title>
      <slot name="title" />
    </template>
    <template #right>
      <slot name="right" />
    </template>
  </UDashboardNavbar>
</template>
