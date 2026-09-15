const NUTRIMENTS = {
  'energy-kcal_100g': 539,
  proteins_100g: 6.3,
  carbohydrates_100g: 57.5,
  fat_100g: 30.9
}

// `match` is what the query is tested against, separate from `product_name`, so the non-English fixtures are still found by q=nutella.
const HITS = [
  { match: 'stub nutella', hit: { code: '4017624010700', product_name: 'Stub Nutella', nutriments: NUTRIMENTS } },
  { match: 'nutella', hit: { code: '4017624010701', product_name: 'Crema de Nutella', lang: 'es', nutriments: NUTRIMENTS } },
  { match: 'nutella', hit: { code: '4017624010702', product_name: 'นูเทลล่าสตับ', lang: 'en', nutriments: NUTRIMENTS } }
]

export default defineEventHandler((event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const q = String(getQuery(event).q ?? '').trim().toLowerCase()
  if (!q) return { hits: [] }
  return { hits: HITS.filter((entry) => entry.match.includes(q)).map((entry) => entry.hit) }
})
