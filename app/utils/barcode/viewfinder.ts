export interface Size {
  width: number
  height: number
}

export interface Crop extends Size {
  x: number
  y: number
}

export const FRAME: Size = { width: 0.8, height: 0.6 }

// Assumes the video is shown with object-fit: cover; an element with no layout size crops relative to the full frame.
export function frameCrop(video: Size, element: Size, frame: Size = FRAME): Crop {
  const box = element.width > 0 && element.height > 0 ? element : video
  const scale = Math.max(box.width / video.width, box.height / video.height)
  const width = Math.round((box.width * frame.width) / scale)
  const height = Math.round((box.height * frame.height) / scale)
  return { x: Math.round((video.width - width) / 2), y: Math.round((video.height - height) / 2), width, height }
}
