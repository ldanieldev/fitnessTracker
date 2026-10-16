<script setup lang="ts">
const modules = useModules()
const saveUser = useSaveUser()

const state = reactive({
  showBody: modules.body.value,
  showWorkouts: modules.workouts.value,
  showNutrition: modules.nutrition.value
})

function save() {
  return saveUser({ ...state }, 'Could not save your choices')
}

defineExpose({ save })
</script>

<template>
  <div class="flex flex-col gap-4" data-test="onboarding-step-modules">
    <USwitch v-model="state.showBody" label="Body" description="Weight, measurements and steps" aria-label="Body" />
    <USwitch
      v-model="state.showWorkouts"
      label="Workouts"
      description="Log lifts, routines and programs"
      aria-label="Workouts"
    />
    <USwitch
      v-model="state.showNutrition"
      label="Nutrition"
      description="Food diary and macro goals"
      aria-label="Nutrition"
    />
  </div>
</template>
