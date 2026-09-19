<script setup lang="ts">
import type { ExerciseCategory, ExerciseDetail } from '~~/shared/types/workout'
import { CATEGORY_DOT_CLASS } from '~~/shared/utils/categoryColors'
import { errorMessage } from '~/utils/apiError'
import ExerciseSettingsPanel from '~/components/workout/ExerciseSettingsPanel.vue'
import ExerciseWorkoutPanel from '~/components/workout/ExerciseWorkoutPanel.vue'
import ExerciseVariationPicker from '~/components/workout/ExerciseVariationPicker.vue'

interface ReferenceData { categories: ExerciseCategory[] }
interface VariationGroup { id: number, name: string, exerciseIds: number[] }

function titleCase(key: string) {
  return key.replace(/(^|[\s-])([a-z])/g, (_match, sep, letter) => sep + letter.toUpperCase())
}

const route = useRoute()
const id = computed(() => Number(route.params.id))
const toast = useToast()

const detailFetch = useExerciseFetch<ExerciseDetail>(
  () => EXERCISE_KEYS.detail(id.value),
  () => `/api/workouts/exercises/${id.value}`,
  { lazy: true }
)
const { data: exercise, error } = detailFetch
// Awaiting only on the server keeps the SSR 404 while client navigation opens the page at once with a skeleton.
if (import.meta.server) {
  await detailFetch
  if (error.value) throw createError({ statusCode: 404, statusMessage: 'Exercise not found', fatal: true })
}
watch(error, (value) => {
  if (value) showError({ statusCode: 404, statusMessage: 'Exercise not found' })
})

const { data: reference } = useExerciseFetch<ReferenceData>(EXERCISE_KEYS.reference, '/api/workouts/reference')
const categories = computed(() => reference.value?.categories ?? [])

const { data: variationGroups } = useExerciseFetch<VariationGroup[]>(
  EXERCISE_KEYS.variations,
  '/api/workouts/variations'
)
const variationGroup = computed(() => variationGroups.value?.find((g) => g.exerciseIds.includes(id.value)))

type Tab = 'about' | 'settings' | 'workout' | 'variations'
const activeTab = ref<Tab>('about')
const tabItems = [
  { label: 'About', value: 'about', test: 'exercise-tab-about' },
  { label: 'Settings', value: 'settings', test: 'exercise-tab-settings' },
  { label: 'Workout', value: 'workout', test: 'exercise-tab-workout' },
  { label: 'Variations', value: 'variations', test: 'exercise-tab-variations' }
]

const dotClass = computed(() => CATEGORY_DOT_CLASS[exercise.value?.category.color ?? ''] ?? CATEGORY_DOT_CLASS.fallback)

async function savePrefs(patch: Record<string, unknown>) {
  try {
    await apiFetch(`/api/workouts/exercises/${id.value}/prefs`, { method: 'PUT', body: patch })
    await invalidateExercises(EXERCISE_KEYS.detail(id.value))
    await invalidateExercises()
  } catch (err: unknown) {
    toast.add({
      title: 'Update failed',
      description: errorMessage(err, 'Could not update this exercise'),
      color: 'error'
    })
  }
}

function onSave(patch: Record<string, unknown>) {
  return savePrefs(patch)
}

function onReset(field: string) {
  return savePrefs({ [field]: null })
}

async function toggleFavorite() {
  if (!exercise.value) return
  try {
    await apiFetch(`/api/workouts/exercises/${id.value}/favorite`, {
      method: exercise.value.favorite ? 'DELETE' : 'PUT'
    })
    await invalidateExercises(EXERCISE_KEYS.detail(id.value))
    await invalidateExercises()
  } catch (err: unknown) {
    toast.add({
      title: 'Update failed',
      description: errorMessage(err, 'Could not update this exercise'),
      color: 'error'
    })
  }
}

function normalizeText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const notes = ref(exercise.value?.notes ?? '')
const link = ref(exercise.value?.link ?? '')
watch(() => exercise.value?.notes, (value) => {
  notes.value = value ?? ''
})
watch(() => exercise.value?.link, (value) => {
  link.value = value ?? ''
})

async function saveNotes() {
  if (!exercise.value) return
  const value = normalizeText(notes.value)
  if (value === (exercise.value.notes ?? null)) return
  await savePrefs({ notes: value })
}

async function saveLink() {
  if (!exercise.value) return
  const value = normalizeText(link.value)
  if (value === (exercise.value.link ?? null)) return
  await savePrefs({ link: value })
}

const failedImages = reactive(new Set<string>())
function onImageError(path: string) {
  failedImages.add(path)
}

const viewerOpen = ref(false)
const viewerIndex = ref(0)
const viewableImages = computed(() => exercise.value?.images.filter((path) => !failedImages.has(path)) ?? [])
const viewerImage = computed(() => viewableImages.value[viewerIndex.value])

function openImage(path: string) {
  viewerIndex.value = Math.max(0, viewableImages.value.indexOf(path))
  viewerOpen.value = true
}

function stepImage(direction: 1 | -1) {
  const count = viewableImages.value.length
  viewerIndex.value = (viewerIndex.value + direction + count) % count
}

const formQuery = computed(() => encodeURIComponent(`${exercise.value?.name ?? ''} form`))
const googleSearchUrl = computed(() => `https://www.google.com/search?q=${formQuery.value}`)
const youtubeSearchUrl = computed(() => `https://www.youtube.com/results?search_query=${formQuery.value}`)

const pickerOpen = ref(false)

async function onLink(payload: { groupId?: number, name?: string, exerciseId: number }) {
  try {
    if (payload.name) {
      await apiFetch('/api/workouts/variations', {
        method: 'POST',
        body: { name: payload.name, exerciseIds: [payload.exerciseId] }
      })
    } else if (payload.groupId !== undefined) {
      await apiFetch(`/api/workouts/variations/${payload.groupId}`, {
        method: 'PATCH',
        body: { addExerciseIds: [payload.exerciseId] }
      })
    }
    await invalidateExercises(EXERCISE_KEYS.variations, EXERCISE_KEYS.detail(id.value))
  } catch (err: unknown) {
    toast.add({ title: 'Link failed', description: errorMessage(err, 'Could not link this variation'), color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel :id="`exercise-${id}`">
    <template #header>
      <UDashboardNavbar :title="exercise?.name ?? ''">
        <template #leading>
          <UButton
            icon="i-lucide-chevron-left"
            variant="ghost"
            color="neutral"
            aria-label="Back"
            class="lg:hidden"
            to="/workouts/exercises"
            data-test="detail-back"
          />
          <UDashboardSidebarCollapse class="hidden lg:flex" />
        </template>
        <template #right>
          <UButton
            v-if="exercise"
            icon="i-lucide-star"
            variant="ghost"
            color="neutral"
            class="min-h-10 min-w-10 justify-center"
            :class="exercise.favorite ? 'text-amber-400' : ''"
            :aria-label="exercise.favorite ? 'Unfavorite' : 'Favorite'"
            data-test="detail-favorite"
            @click="toggleFavorite"
          />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div
        v-if="!exercise"
        class="mx-auto flex w-full max-w-2xl flex-col gap-4"
        data-test="detail-skeleton"
        aria-busy="true"
      >
        <USkeleton class="h-5 w-32" />
        <div class="flex gap-1">
          <USkeleton class="h-5 w-20" />
          <USkeleton class="h-5 w-24" />
        </div>
        <USkeleton class="h-10 w-full rounded-lg" />
        <div class="grid grid-cols-2 gap-2">
          <USkeleton class="aspect-square rounded" />
          <USkeleton class="aspect-square rounded" />
        </div>
        <USkeleton v-for="i in 4" :key="i" class="h-4 w-full" />
      </div>
      <div v-else class="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-1">
            <UBadge variant="subtle" color="neutral" size="sm" class="gap-1.5" data-test="detail-category">
              <span class="size-2 shrink-0 rounded-full" :class="dotClass" />
              {{ exercise.category.name }}
            </UBadge>
            <UBadge
              v-for="key in exercise.equipment"
              :key="key"
              :label="titleCase(key)"
              variant="subtle"
              color="neutral"
              size="sm"
            />
          </div>
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="key in exercise.primaryMuscles"
              :key="key"
              :label="titleCase(key)"
              variant="subtle"
              color="primary"
              size="sm"
            />
            <UBadge
              v-for="key in exercise.secondaryMuscles"
              :key="key"
              :label="titleCase(key)"
              variant="subtle"
              color="neutral"
              size="sm"
              class="opacity-60"
            />
          </div>
        </div>

        <UTabs v-model="activeTab" :items="tabItems" :content="false" :ui="{ trigger: 'min-h-10' }" class="w-full">
          <template #default="{ item }">
            <span :data-test="item.test">{{ item.label }}</span>
          </template>
        </UTabs>

        <div v-show="activeTab === 'about'" class="flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-2">
            <template v-if="exercise.images.length">
              <div
                v-for="(path, index) in exercise.images"
                :key="path"
                class="aspect-square overflow-hidden rounded bg-elevated"
              >
                <button
                  v-if="!failedImages.has(path)"
                  type="button"
                  class="size-full cursor-zoom-in"
                  :aria-label="`View photo ${index + 1} larger`"
                  :data-test="`detail-image-${index}`"
                  @click="openImage(path)"
                >
                  <NuxtImg
                    :src="`/exercises/${path}`"
                    class="size-full rounded object-cover"
                    loading="lazy"
                    @error="onImageError(path)"
                  />
                </button>
                <div v-else class="flex size-full items-center justify-center">
                  <UIcon name="i-lucide-dumbbell" class="size-8 text-dimmed" />
                </div>
              </div>
            </template>
            <div v-else class="col-span-2 flex h-40 items-center justify-center rounded bg-elevated">
              <UIcon name="i-lucide-dumbbell" class="size-10 text-dimmed" />
            </div>
          </div>

          <ol v-if="exercise.instructions.length" class="list-decimal space-y-1 pl-5 text-sm">
            <li v-for="(step, index) in exercise.instructions" :key="index">{{ step }}</li>
          </ol>

          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium text-dimmed">Notes</span>
            <UTextarea v-model="notes" :rows="3" class="w-full" data-test="detail-notes" @blur="saveNotes" />
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-sm font-medium text-dimmed">Link</span>
            <UInput v-model="link" placeholder="https://" class="w-full" data-test="detail-link" @blur="saveLink" />
          </div>

          <div class="flex gap-2">
            <UButton
              label="Search form"
              icon="i-lucide-search"
              variant="soft"
              color="neutral"
              class="min-h-10 flex-1"
              :to="googleSearchUrl"
              target="_blank"
              rel="noopener"
            />
            <UButton
              label="Watch form"
              icon="i-lucide-youtube"
              variant="soft"
              color="neutral"
              class="min-h-10 flex-1"
              :to="youtubeSearchUrl"
              target="_blank"
              rel="noopener"
            />
          </div>
        </div>

        <div v-show="activeTab === 'settings'">
          <ExerciseSettingsPanel :exercise="exercise" :categories="categories" @save="onSave" @reset="onReset" />
        </div>

        <div v-show="activeTab === 'workout'">
          <ExerciseWorkoutPanel :exercise="exercise" @save="onSave" @reset="onReset" />
        </div>

        <div v-show="activeTab === 'variations'" class="flex flex-col gap-3">
          <div data-test="variation-list" class="flex flex-col gap-2">
            <template v-if="variationGroup">
              <p class="text-sm font-medium text-highlighted">{{ variationGroup.name }}</p>
              <NuxtLink
                v-for="variation in exercise.variations"
                :key="variation.id"
                :to="`/workouts/exercises/${variation.id}`"
                class="flex min-h-10 items-center rounded-xl bg-elevated px-3 py-2 text-sm"
              >
                {{ variation.name }}
              </NuxtLink>
            </template>
            <p v-else class="text-sm text-dimmed">No variations linked yet</p>
          </div>
          <UButton
            label="Link variation"
            variant="soft"
            color="neutral"
            class="min-h-10"
            data-test="variation-link"
            @click="pickerOpen = true"
          />
        </div>
      </div>

      <ExerciseVariationPicker
        v-if="exercise"
        v-model:open="pickerOpen"
        :exercise="exercise"
        :groups="variationGroups ?? []"
        @link="onLink"
      />
      <UModal
        v-if="exercise"
        v-model:open="viewerOpen"
        :title="exercise.name"
        fullscreen
        :ui="{ header: 'sr-only', body: 'p-0 sm:p-0' }"
      >
        <template #body>
          <div class="relative flex h-full w-full items-center justify-center" data-test="image-viewer">
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              class="absolute right-2 top-2 z-10 min-h-10 min-w-10 justify-center bg-default/80 backdrop-blur"
              aria-label="Close photo"
              data-test="image-viewer-close"
              @click="viewerOpen = false"
            />
            <!-- The source photos are only 375px wide, so the element is sized and the image scaled into it. -->
            <NuxtImg
              v-if="viewerImage"
              :key="viewerImage"
              :src="`/exercises/${viewerImage}`"
              class="mx-auto h-full w-full object-contain"
            />
            <div
              v-if="viewableImages.length > 1"
              class="absolute inset-x-0 bottom-2 flex items-center justify-center gap-3"
            >
              <div class="flex items-center gap-3 rounded-full bg-default/80 px-2 py-1 backdrop-blur">
                <UButton
                  icon="i-lucide-chevron-left"
                  variant="ghost"
                  color="neutral"
                  class="min-h-10 min-w-10 justify-center"
                  aria-label="Previous photo"
                  data-test="image-viewer-prev"
                  @click="stepImage(-1)"
                />
                <span class="text-sm text-dimmed" data-test="image-viewer-count">
                  {{ viewerIndex + 1 }} / {{ viewableImages.length }}
                </span>
                <UButton
                  icon="i-lucide-chevron-right"
                  variant="ghost"
                  color="neutral"
                  class="min-h-10 min-w-10 justify-center"
                  aria-label="Next photo"
                  data-test="image-viewer-next"
                  @click="stepImage(1)"
                />
              </div>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
