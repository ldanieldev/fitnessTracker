export function hasExtension(file: File, extension: string) {
  return file.name.toLowerCase().endsWith(extension)
}

export function splitByExtension(files: File[], extension: string) {
  const kept: File[] = []
  const skipped: File[] = []
  for (const file of files) (hasExtension(file, extension) ? kept : skipped).push(file)
  return { kept, skipped }
}
