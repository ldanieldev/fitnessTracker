<script setup lang="ts">
const { loggedIn } = useUserSession()

watch(loggedIn, () => {
  if (loggedIn.value) {
    navigateTo('/')
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <slot />
  </div>
</template>
