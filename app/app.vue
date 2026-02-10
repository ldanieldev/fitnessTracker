<script setup>
useHead({
  meta: [{ charset: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'en'
  }
})

const { appName } = useRuntimeConfig().public
const title = `${appName} Fitness Journal`
const description =
  'Track your workouts, monitor your progress, and reach your fitness goals. Your personal fitness journal to log exercises, stay consistent, and build healthy habits.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
