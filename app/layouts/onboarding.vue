<script setup lang="ts">
const { loggedIn } = useUserSession()

watch(loggedIn, () => {
  if (!loggedIn.value) navigateTo('/auth/login')
})
</script>

<template>
  <div class="min-h-dvh bg-default">
    <slot />
  </div>
</template>
