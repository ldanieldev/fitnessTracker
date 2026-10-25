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

// Second fixture, distinct from the real Cheerios barcode already in the dev DB, for a "scan two barcodes" flow.
const STUB_BARCODE_2 = '4017624010717'
const STUB_PRODUCT_2 = {
  code: STUB_BARCODE_2,
  product_name: 'Stub Cheerios',
  nutriments: {
    'energy-kcal_100g': 379,
    proteins_100g: 7.5,
    carbohydrates_100g: 74,
    fat_100g: 6.5
  }
}

// Biscoff-like record whose macros are a 30 g serving's stored as per-100 g, so its kcal disagrees with them.
const STUB_BARCODE_3 = '4017624010724'
const STUB_PRODUCT_3 = {
  code: STUB_BARCODE_3,
  product_name: 'Stub Biscoff Spread',
  nutriments: {
    'energy-kcal_100g': 566.7,
    proteins_100g: 1,
    carbohydrates_100g: 17,
    fat_100g: 11
  }
}

const STUB_PRODUCTS: Record<string, typeof STUB_PRODUCT> = {
  [STUB_BARCODE]: STUB_PRODUCT,
  [STUB_BARCODE_2]: STUB_PRODUCT_2,
  [STUB_BARCODE_3]: STUB_PRODUCT_3
}

export default defineEventHandler((event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  // off.ts requests "<productUrl>/<code>.json?fields=...": the dynamic segment still carries the .json suffix.
  const code = (getRouterParam(event, 'code') ?? '').replace(/\.json$/, '')
  const product = STUB_PRODUCTS[code]
  if (!product) return { status: 0 }
  return { status: 1, product }
})
