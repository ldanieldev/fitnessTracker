export const EXERCISE_ASSET_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/a859101d633a01c4a1a920d6a8ce41dabba0705f/exercises'

export function assetPlan(images: string[], existing: Set<string>) {
  return [...new Set(images)]
    .filter((path) => !existing.has(path))
    .map((path) => ({ path, url: `${EXERCISE_ASSET_BASE}/${path}` }))
}
