function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function saveAsSummary(skippedQuickAdds: number, flattenedRecipes: number): string {
  const parts = ['Saved']
  if (skippedQuickAdds > 0) parts.push(`${plural(skippedQuickAdds, 'quick-add', 'quick-adds')} skipped`)
  if (flattenedRecipes > 0) parts.push(`${plural(flattenedRecipes, 'recipe', 'recipes')} flattened`)
  return parts.join(' · ')
}
