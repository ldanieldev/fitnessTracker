<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  subtitle?: string | null
  nutrients?: Record<string, number | null | undefined> | null
  amountText?: string | null
  energy?: number | null
  selectable?: boolean
  selected?: boolean
  chevron?: boolean
  disabled?: boolean
  dataTest?: string
  checkboxTest?: string
  macroTestPrefix?: string
  rootClass?: string
}>(), {
  subtitle: null,
  nutrients: null,
  amountText: null,
  energy: null,
  selectable: false,
  selected: false,
  chevron: false,
  disabled: false,
  dataTest: 'result-row',
  checkboxTest: undefined,
  macroTestPrefix: 'macro',
  rootClass: ''
})

const emit = defineEmits<{ toggle: [on: boolean], open: [] }>()

const checkboxHook = computed(() => props.checkboxTest ?? `${props.dataTest}-checkbox`)

function onTap() {
  if (props.disabled) return
  if (props.selectable) emit('toggle', !props.selected)
  else if (props.chevron) emit('open')
}
</script>

<template>
  <div class="rounded-xl bg-elevated" :class="rootClass" :data-test="dataTest">
    <div
      class="flex items-center gap-3 px-3 py-2 min-h-14"
      :class="[(selectable || chevron) && !disabled ? 'cursor-pointer active:bg-accented' : '', disabled ? 'opacity-60' : '']"
      :role="selectable || chevron ? 'button' : undefined"
      :tabindex="selectable || chevron ? 0 : undefined"
      @click="onTap"
      @keydown.enter="onTap"
      @keydown.space.prevent="onTap"
    >
      <UCheckbox v-if="selectable" :model-value="selected" :disabled="disabled" :data-test="checkboxHook" @click.stop @update:model-value="(v) => emit('toggle', Boolean(v))" />
      <div class="min-w-0 flex-1">
        <div class="truncate font-medium text-highlighted">{{ title }}</div>
        <div class="flex flex-wrap items-baseline gap-x-2 text-xs text-dimmed">
          <span v-if="subtitle" class="truncate">{{ subtitle }}</span>
          <span v-if="amountText">{{ amountText }}</span>
          <NutritionMacroText v-if="nutrients" :nutrients="nutrients" :test-prefix="macroTestPrefix" />
        </div>
        <slot name="meta" />
      </div>
      <div v-if="energy !== null" class="text-right tabular-nums leading-tight" :data-test="`${macroTestPrefix}-energy`">
        <div class="font-semibold">{{ Math.round(energy) }}</div>
        <div class="text-[10px] text-dimmed">kcal</div>
      </div>
      <slot name="actions" />
      <UIcon v-if="chevron" name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
    </div>
    <div v-if="$slots.default" class="border-t border-default px-3 py-2">
      <slot />
    </div>
  </div>
</template>
