import { describe, expect, it } from 'vitest'
import { frameCrop } from '../../app/utils/barcode/viewfinder'

describe('frameCrop', () => {
  it('maps the frame on a wide viewfinder back onto a portrait stream it crops', () => {
    expect(frameCrop({ width: 480, height: 640 }, { width: 360, height: 202.5 })).toEqual({
      x: 48,
      y: 239,
      width: 384,
      height: 162
    })
  })

  it('maps the frame onto a stream with the same shape as the viewfinder', () => {
    expect(frameCrop({ width: 1280, height: 720 }, { width: 640, height: 360 })).toEqual({
      x: 128,
      y: 144,
      width: 1024,
      height: 432
    })
  })

  it('crops relative to the full frame when the viewfinder has no layout size', () => {
    expect(frameCrop({ width: 640, height: 480 }, { width: 0, height: 0 })).toEqual({
      x: 64,
      y: 96,
      width: 512,
      height: 288
    })
  })
})
