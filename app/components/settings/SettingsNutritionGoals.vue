<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'
import { RATIO_MACROS } from '~~/shared/utils/nutritionGoals'

interface CatalogEntry {
  key: string
  name: string
  unit: string
  defaultDirection: 'min' | 'max' | 'target'
}

interface TrackedNutrient {
  key: string
  name: string
  unit: string
}

interface ProfileTarget {
  nutrient: string
  amount: number
  direction: 'min' | 'max' | 'target'
  ratioPercent: number | null
}

interface Profile {
  id: number
  name: string
  inputMode: 'grams' | 'ratio'
  calories: number | null
  isDefault: boolean
  targets: ProfileTarget[]
}

const props = defineProps<{
  profiles: Profile[]
  catalog: CatalogEntry[]
  tracked: TrackedNutrient[]
}>()
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()

function displayKcal(profile: Profile) {
  if (profile.calories !== null) return profile.calories
  return profile.targets.find((t) => t.nutrient === 'energy')?.amount ?? null
}

const directionItems = [
  { label: 'At least (min)', value: 'min' },
  { label: 'At most (max)', value: 'max' },
  { label: 'Target', value: 'target' }
]

interface RowState {
  enabled: boolean
  amount: number | undefined
  ratioPercent: number | undefined
  direction: 'min' | 'max' | 'target'
}

const modalOpen = ref(false)
const editing = ref<Profile | null>(null)
const name = ref('')
const inputMode = ref<'grams' | 'ratio'>('grams')
const calories = ref<number | undefined>(undefined)
const isDefault = ref(false)
const rows = ref<Record<string, RowState>>({})
const saving = ref(false)

const rowKeys = computed(() => {
  const keys = new Set(props.tracked.map((t) => t.key))
  for (const key of Object.keys(rows.value)) keys.add(key)
  return props.catalog.filter((n) => keys.has(n.key)).map((n) => n.key)
})

function nutrientMeta(key: string) {
  return props.catalog.find((n) => n.key === key) ?? props.tracked.find((t) => t.key === key)
}

function resetRows(profile: Profile | null) {
  const keys = new Set(props.tracked.map((t) => t.key))
  for (const target of profile?.targets ?? []) keys.add(target.nutrient)
  // Ratio mode's inputs are always protein/carb/fat, even if one has been untracked — otherwise untracking a macro permanently blocks ratio profiles.
  if (inputMode.value === 'ratio') for (const macro of RATIO_MACROS) keys.add(macro)
  const next: Record<string, RowState> = {}
  for (const key of keys) {
    const target = profile?.targets.find((t) => t.nutrient === key)
    const catalogEntry = props.catalog.find((n) => n.key === key)
    next[key] = {
      enabled: Boolean(target),
      amount: target?.amount,
      ratioPercent: target?.ratioPercent ?? undefined,
      direction: target?.direction ?? catalogEntry?.defaultDirection ?? 'target'
    }
  }
  rows.value = next
}

watch(inputMode, () => resetRows(editing.value))

function openCreate() {
  editing.value = null
  name.value = ''
  inputMode.value = 'grams'
  calories.value = undefined
  isDefault.value = false
  resetRows(null)
  modalOpen.value = true
}

function openEdit(profile: Profile) {
  editing.value = profile
  name.value = profile.name
  inputMode.value = profile.inputMode
  calories.value = profile.calories ?? undefined
  isDefault.value = profile.isDefault
  resetRows(profile)
  modalOpen.value = true
}

async function submit() {
  if (!name.value.trim()) {
    toast.add({ title: 'Name is required', color: 'error' })
    return
  }

  const targets: Array<{ nutrient: string, amount?: number, ratioPercent?: number, direction: string }> = []

  if (inputMode.value === 'ratio') {
    if (!calories.value) {
      toast.add({ title: 'Calories is required for ratio mode', color: 'error' })
      return
    }
    for (const macro of RATIO_MACROS) {
      const row = rows.value[macro]
      if (row?.ratioPercent === undefined) {
        toast.add({ title: `${macro} ratio % is required for ratio mode`, color: 'error' })
        return
      }
      targets.push({ nutrient: macro, ratioPercent: row.ratioPercent, direction: row.direction })
    }
  }

  for (const key of rowKeys.value) {
    if (inputMode.value === 'ratio' && (RATIO_MACROS as readonly string[]).includes(key)) continue
    const row = rows.value[key]
    if (!row?.enabled) continue
    if (row.amount === undefined) {
      toast.add({ title: `Amount is required for ${nutrientMeta(key)?.name ?? key}`, color: 'error' })
      return
    }
    targets.push({ nutrient: key, amount: row.amount, direction: row.direction })
  }

  if (!targets.length) {
    toast.add({ title: 'Add at least one target', color: 'error' })
    return
  }

  const body = {
    name: name.value.trim(),
    inputMode: inputMode.value,
    calories: inputMode.value === 'ratio' ? calories.value : (calories.value ?? null),
    isDefault: isDefault.value,
    targets
  }

  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/nutrition/goal-profiles/${editing.value.id}`, { method: 'PUT', body })
    } else {
      await $fetch('/api/nutrition/goal-profiles', { method: 'POST', body })
    }
    modalOpen.value = false
    emit('changed')
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save goal profile'), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function setDefault(profile: Profile) {
  try {
    await $fetch(`/api/nutrition/goal-profiles/${profile.id}`, {
      method: 'PUT',
      body: {
        name: profile.name,
        inputMode: profile.inputMode,
        calories: profile.calories,
        isDefault: true,
        targets: profile.targets.map((t) => ({
          nutrient: t.nutrient,
          amount: t.ratioPercent === null ? t.amount : undefined,
          ratioPercent: t.ratioPercent ?? undefined,
          direction: t.direction
        }))
      }
    })
  } catch (error: unknown) {
    toast.add({ title: 'Set default failed', description: errorMessage(error, 'Could not set default profile'), color: 'error' })
  } finally {
    emit('changed')
  }
}

const deleteTarget = ref<Profile | null>(null)
const deleteModalOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (value: boolean) => {
    if (!value) deleteTarget.value = null
  }
})

async function confirmDelete() {
  if (!deleteTarget.value) return
  try {
    await $fetch(`/api/nutrition/goal-profiles/${deleteTarget.value.id}`, { method: 'DELETE' })
  } catch (error: unknown) {
    toast.add({ title: 'Delete failed', description: errorMessage(error, 'Could not delete goal profile'), color: 'error' })
  } finally {
    deleteTarget.value = null
    emit('changed')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-for="profile in profiles" :key="profile.id" data-test="goal-profile-row" class="flex items-center justify-between gap-2 p-3 rounded-lg border border-default">
      <div class="flex items-center gap-2">
        <span class="font-medium">{{ profile.name }}</span>
        <span class="text-sm text-dimmed">{{ displayKcal(profile) !== null ? `${displayKcal(profile)} kcal` : '—' }}</span>
        <UBadge v-if="profile.isDefault" color="primary" variant="subtle" label="Default" />
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="!profile.isDefault"
          label="Set as default"
          size="sm"
          variant="soft"
          color="neutral"
          :data-test="`goal-set-default-${profile.id}`"
          @click="setDefault(profile)"
        />
        <UButton label="Edit" size="sm" variant="ghost" color="neutral" @click="openEdit(profile)" />
        <UButton
          label="Delete"
          size="sm"
          variant="ghost"
          color="error"
          :data-test="`goal-delete-${profile.id}`"
          @click="deleteTarget = profile"
        />
      </div>
    </div>

    <UButton label="Add goal profile" class="w-fit" data-test="add-goal-profile" @click="openCreate" />

    <UModal v-model:open="modalOpen" :title="editing ? 'Edit goal profile' : 'New goal profile'">
      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField label="Name" required>
            <UInput v-model="name" data-test="goal-name" class="w-full" />
          </UFormField>

          <UFormField label="Input mode">
            <USelect
              v-model="inputMode"
              :items="[{ label: 'Grams', value: 'grams' }, { label: 'Ratio', value: 'ratio' }]"
              data-test="goal-input-mode"
              class="w-full"
            />
          </UFormField>

          <UFormField v-if="inputMode === 'ratio'" label="Calories" required>
            <UInput v-model.number="calories" type="number" data-test="goal-calories" class="w-full" />
          </UFormField>

          <div class="flex flex-col gap-2">
            <div v-for="key in rowKeys" :key="key" class="flex items-center gap-2" :data-test="`goal-row-${key}`">
              <template v-if="inputMode === 'ratio' && (RATIO_MACROS as readonly string[]).includes(key)">
                <span class="w-32 text-sm font-medium">{{ nutrientMeta(key)?.name }}</span>
                <UInput
                  v-model.number="rows[key]!.ratioPercent"
                  type="number"
                  placeholder="%"
                  :data-test="`goal-ratio-${key}`"
                  class="w-24"
                />
                <USelect v-model="rows[key]!.direction" :items="directionItems" :data-test="`goal-direction-${key}`" class="flex-1" />
              </template>
              <template v-else>
                <UCheckbox v-model="rows[key]!.enabled" :data-test="`goal-enable-${key}`" />
                <span class="w-32 text-sm font-medium">{{ nutrientMeta(key)?.name }}</span>
                <UInput
                  v-model.number="rows[key]!.amount"
                  type="number"
                  :disabled="!rows[key]!.enabled"
                  :placeholder="nutrientMeta(key)?.unit"
                  :data-test="`goal-amount-${key}`"
                  class="w-24"
                />
                <USelect
                  v-model="rows[key]!.direction"
                  :items="directionItems"
                  :disabled="!rows[key]!.enabled"
                  :data-test="`goal-direction-${key}`"
                  class="flex-1"
                />
              </template>
            </div>
          </div>

          <UCheckbox v-model="isDefault" label="Set as default" data-test="goal-is-default" />
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="modalOpen = false" />
          <UButton label="Save" :loading="saving" data-test="goal-save" @click="submit" />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteModalOpen"
      title="Delete goal profile"
      :description="`Delete ${deleteTarget?.name}? Days already logged keep their snapshotted targets.`"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="deleteTarget = null" />
          <UButton label="Delete" color="error" data-test="confirm-delete-goal" @click="confirmDelete" />
        </div>
      </template>
    </UModal>
  </div>
</template>
