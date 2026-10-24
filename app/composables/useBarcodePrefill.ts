import { EXTERNAL_SOURCE_LABELS, type ExternalFood } from '~/composables/useBarcodeLookup'
import { errorMessage } from '~/utils/apiError'

export interface PrefillHeader {
  name: string
  brand: string
}

export function useBarcodePrefill() {
  const toast = useToast()
  const { lookup } = useBarcodeLookup()
  const looking = ref(false)

  async function find(code: string): Promise<ExternalFood | null> {
    looking.value = true
    try {
      const result = await lookup(code, { externalOnly: true })
      if (result.kind === 'external') return result.external
      toast.add({
        title: result.kind === 'missing' && result.errors.length > 0 ? 'Barcode sources unavailable' : 'No match',
        description: 'Nothing was filled in for this barcode',
        color: 'warning'
      })
    } catch (err: unknown) {
      reportFailure(err, 'Barcode prefill')
      toast.add({
        title: 'Lookup failed',
        description: errorMessage(err, 'Could not look up this barcode'),
        color: 'error'
      })
    } finally {
      looking.value = false
    }
    return null
  }

  function fillHeader(header: PrefillHeader, external: ExternalFood): number {
    let filled = 0
    if (!header.name.trim() && external.name) {
      header.name = external.name
      filled += 1
    }
    if (!header.brand.trim() && external.brand) {
      header.brand = external.brand
      filled += 1
    }
    return filled
  }

  function report(filled: number, external: ExternalFood) {
    const source = EXTERNAL_SOURCE_LABELS[external.source]
    toast.add(
      filled > 0
        ? { title: `Filled ${filled} ${filled === 1 ? 'field' : 'fields'} from ${source}`, color: 'success' }
        : { title: 'Nothing to fill', description: `Every field ${source} has is already filled in`, color: 'neutral' }
    )
  }

  return { looking, find, fillHeader, report }
}
