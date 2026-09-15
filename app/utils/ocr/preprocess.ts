// Fixed threshold in place of a full Otsu implementation; adequate for high-contrast printed nutrition labels.
const THRESHOLD = 140

export async function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context unavailable')
  context.drawImage(bitmap, 0, 0)
  return canvas
}

export function preprocessForOcr(canvas: HTMLCanvasElement): ImageData {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context unavailable')
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114
    const value = gray >= THRESHOLD ? 255 : 0
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
  }
  context.putImageData(imageData, 0, 0)
  return imageData
}
