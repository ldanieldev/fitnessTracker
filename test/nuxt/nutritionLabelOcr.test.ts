import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createWorker } from 'tesseract.js'
import NutritionLabelOcr from '../../app/components/nutrition/NutritionLabelOcr.vue'

const usLabel = `Nutrition Facts
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g 10%
Saturated Fat 1g 5%
Cholesterol 0mg 0%
Sodium 160mg 7%
Total Carbohydrate 37g 13%
Dietary Fiber 4g 14%
Total Sugars 12g
Protein 3g`

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: async () => ({ data: { text: usLabel } }),
    terminate: async () => {}
  }))
}))

// happy-dom's canvas has no adapter registered (getContext('2d') returns null), so image
// loading/preprocessing can't run here; stub the module to hand back an inert canvas.
vi.mock('~/utils/ocr/preprocess', () => ({
  loadImageToCanvas: vi.fn(async () => document.createElement('canvas')),
  preprocessForOcr: vi.fn(() => ({}) as ImageData)
}))

async function selectFile(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  const input = wrapper.find('[data-test="ocr-file"]').element as HTMLInputElement
  const file = new File(['fake-image-bytes'], 'label.jpg', { type: 'image/jpeg' })
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(file)
  Object.defineProperty(input, 'files', { value: dataTransfer.files, configurable: true })
  await wrapper.find('[data-test="ocr-file"]').trigger('change')
}

describe('NutritionLabelOcr', () => {
  it('recognizes a label photo and emits the parsed result on Apply', async () => {
    const wrapper = await mountSuspended(NutritionLabelOcr)

    await selectFile(wrapper)
    await vi.waitFor(() => expect(wrapper.find('[data-test="ocr-fields"]').exists()).toBe(true))

    expect(wrapper.find('[data-test="ocr-raw"]').text()).toBe(usLabel)

    expect(createWorker).toHaveBeenCalledWith('eng', undefined, expect.objectContaining({
      workerPath: expect.stringMatching(/^\/ocr\//),
      corePath: expect.stringMatching(/^\/ocr\//),
      langPath: expect.stringMatching(/^\/ocr\//)
    }))

    await wrapper.find('[data-test="ocr-apply"]').trigger('click')

    const emitted = wrapper.emitted('parsed')
    expect(emitted).toHaveLength(1)
    expect(emitted![0]![0]).toEqual({
      servingGrams: 55,
      nutrients: {
        energy: 230,
        fat: 8,
        saturatedFat: 1,
        cholesterol: 0,
        sodium: 160,
        carbohydrate: 37,
        fiber: 4,
        sugar: 12,
        protein: 3
      },
      confidence: 0.9
    })
  })

  it('terminates the worker on unmount and ignores the in-flight result', async () => {
    const terminate = vi.fn(async () => {})
    let resolveRecognize: (value: { data: { text: string } }) => void = () => {}
    const recognizePromise = new Promise<{ data: { text: string } }>((resolve) => {
      resolveRecognize = resolve
    })
    vi.mocked(createWorker).mockImplementationOnce(async () => ({
      recognize: () => recognizePromise,
      terminate
    }) as never)

    const wrapper = await mountSuspended(NutritionLabelOcr)
    await selectFile(wrapper)
    await flushPromises()

    wrapper.unmount()
    expect(terminate).toHaveBeenCalledTimes(1)

    resolveRecognize({ data: { text: usLabel } })
    await flushPromises()

    expect(terminate).toHaveBeenCalledTimes(1)
  })
})
