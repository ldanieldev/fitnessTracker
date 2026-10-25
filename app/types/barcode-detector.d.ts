export {}

declare global {
  interface DetectedBarcode {
    format: string
    rawValue: string
    cornerPoints: ReadonlyArray<{ x: number; y: number }>
  }

  interface BarcodeDetectorOptions {
    formats?: string[]
  }

  class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions)
    static getSupportedFormats(): Promise<string[]>
    detect(image: CanvasImageSource): Promise<DetectedBarcode[]>
  }

  interface Window {
    BarcodeDetector?: typeof BarcodeDetector
  }
}
