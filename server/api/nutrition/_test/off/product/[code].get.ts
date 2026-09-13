const STUB_BARCODE = '4017624010700'
const STUB_PRODUCT = {
  code: STUB_BARCODE,
  product_name: 'Stub Nutella',
  nutriments: {
    'energy-kcal_100g': 539,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9
  }
}

export default defineEventHandler((event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  // off.ts requests "<productUrl>/<code>.json?fields=...": the dynamic segment still carries the .json suffix.
  const code = (getRouterParam(event, 'code') ?? '').replace(/\.json$/, '')
  if (code !== STUB_BARCODE) return { status: 0 }
  return { status: 1, product: STUB_PRODUCT }
})
