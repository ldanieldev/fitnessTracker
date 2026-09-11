import type { PickedFood } from '~/types/nutrition'
import { type EditorLine, isLineBroken, linesTotal, nextUid } from '~/utils/nutrition/lines'

// snapshot takes `lines` as a param rather than closing over it, since `lines` is only created below.
export function useLibraryEditor(snapshot: (lines: EditorLine[]) => string, initiallyLoaded: boolean) {
  const { idToKey } = useNutrientCatalog()

  const lines = ref<EditorLine[]>([])
  const loaded = ref(initiallyLoaded)
  const saving = ref(false)
  const baseline = ref('')

  const dirty = computed(() => loaded.value && snapshot(lines.value) !== baseline.value)
  const total = computed(() => linesTotal(lines.value, idToKey.value))
  const hasBroken = computed(() => lines.value.some(isLineBroken))

  onBeforeRouteLeave(() => {
    if (dirty.value && !window.confirm('Discard unsaved changes?')) return false
  })

  const pickerOpen = ref(false)
  const replaceUid = ref<string | null>(null)

  function openPicker(uid: string | null) {
    replaceUid.value = uid
    pickerOpen.value = true
  }

  function onPicked(picked: PickedFood[]) {
    const added = picked.map((p) => ({ uid: nextUid(), foodId: p.foodId, name: p.name, brand: p.brand, quantity: p.quantity, unitLabel: p.unitLabel, food: p.food }))
    if (replaceUid.value) {
      lines.value = lines.value.flatMap((line) => (line.uid === replaceUid.value ? added.slice(0, 1) : [line]))
    } else {
      lines.value = [...lines.value, ...added]
    }
    replaceUid.value = null
  }

  const editingUid = ref<string | null>(null)
  const editingLine = computed(() => lines.value.find((l) => l.uid === editingUid.value) ?? null)
  const sheetOpen = computed({
    get: () => editingUid.value !== null,
    set: (value: boolean) => {
      if (!value) editingUid.value = null
    }
  })

  function onLineUpdate(updated: EditorLine) {
    lines.value = lines.value.map((line) => (line.uid === updated.uid ? updated : line))
  }

  function onLineRemove(uid: string) {
    lines.value = lines.value.filter((line) => line.uid !== uid)
  }

  const deleteOpen = ref(false)

  return {
    idToKey,
    lines,
    loaded,
    saving,
    baseline,
    dirty,
    total,
    hasBroken,
    pickerOpen,
    replaceUid,
    openPicker,
    onPicked,
    editingUid,
    editingLine,
    sheetOpen,
    onLineUpdate,
    onLineRemove,
    deleteOpen
  }
}
