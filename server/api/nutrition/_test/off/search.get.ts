const STUB_HIT = {
  code: '4017624010700',
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
  const q = String(getQuery(event).q ?? '').trim().toLowerCase()
  // Substring match against the stub's own name so both "stub" (brief) and "nutella" (existing specs) hit it.
  if (!q || !STUB_HIT.product_name.toLowerCase().includes(q)) return { hits: [] }
  return { hits: [STUB_HIT] }
})
