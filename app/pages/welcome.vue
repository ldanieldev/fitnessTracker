<script setup lang="ts">
import { onboardingSteps, type OnboardingStep } from '~~/shared/utils/onboarding'
import { errorMessage } from '~/utils/apiError'

definePageMeta({ layout: 'onboarding' })

const { appName } = useRuntimeConfig().public
const { fetch: fetchSession } = useUserSession()
const modules = useModules()
const toast = useToast()

const steps = computed(() =>
  onboardingSteps({ body: modules.body.value, workouts: modules.workouts.value, nutrition: modules.nutrition.value })
)
const current = ref<OnboardingStep>('about')
const index = computed(() => steps.value.indexOf(current.value))
const stepRef = ref<{ save: () => Promise<boolean> } | null>(null)
const busy = ref(false)

const titles: Record<OnboardingStep, string> = {
  about: 'About you',
  modules: 'What you’ll track',
  body: 'Body',
  nutrition: 'Nutrition',
  workouts: 'Workouts',
  done: 'All set'
}

function go(offset: number) {
  const next = steps.value[index.value + offset]
  if (next) current.value = next
}

async function next() {
  busy.value = true
  try {
    if (stepRef.value && !(await stepRef.value.save())) return
    go(1)
  } finally {
    busy.value = false
  }
}

async function finish() {
  busy.value = true
  try {
    await apiFetch('/api/onboarding/complete', { method: 'POST' })
    await fetchSession()
    await navigateTo('/')
  } catch (error: unknown) {
    toast.add({ title: 'Could not finish setup', description: errorMessage(error, 'Try again'), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-4 sm:py-8">
    <header class="flex items-center justify-between gap-3">
      <span class="font-semibold text-highlighted">{{ appName }}</span>
      <div class="flex items-center gap-1">
        <UButton
          label="Log out"
          variant="link"
          color="neutral"
          :disabled="busy"
          data-test="onboarding-logout"
          @click="signOut"
        />
        <UButton
          v-if="current !== 'done'"
          label="Skip setup"
          variant="link"
          color="neutral"
          :disabled="busy"
          data-test="onboarding-skip-all"
          @click="finish"
        />
      </div>
    </header>

    <div class="flex flex-col gap-2">
      <p class="text-sm text-muted" data-test="onboarding-progress">Step {{ index + 1 }} of {{ steps.length }}</p>
      <UProgress :model-value="index + 1" :max="steps.length" size="sm" />
      <h1 class="text-xl font-semibold text-highlighted">{{ titles[current] }}</h1>
    </div>

    <main class="flex-1">
      <OnboardingAbout v-if="current === 'about'" ref="stepRef" />
      <OnboardingModules v-else-if="current === 'modules'" ref="stepRef" />
      <OnboardingBody v-else-if="current === 'body'" ref="stepRef" />
      <OnboardingNutrition v-else-if="current === 'nutrition'" ref="stepRef" />
      <OnboardingWorkouts v-else-if="current === 'workouts'" ref="stepRef" />
      <OnboardingDone v-else />
    </main>

    <footer class="flex items-center justify-between gap-2 border-t border-default pt-4">
      <UButton
        label="Back"
        variant="ghost"
        color="neutral"
        :disabled="index === 0 || busy"
        data-test="onboarding-back"
        @click="go(-1)"
      />
      <div v-if="current !== 'done'" class="flex gap-2">
        <UButton
          label="Skip"
          variant="ghost"
          color="neutral"
          :disabled="busy"
          data-test="onboarding-skip"
          @click="go(1)"
        />
        <UButton label="Next" :loading="busy" data-test="onboarding-next" @click="next" />
      </div>
      <UButton v-else label="Go to dashboard" :loading="busy" data-test="onboarding-finish" @click="finish" />
    </footer>
  </div>
</template>
