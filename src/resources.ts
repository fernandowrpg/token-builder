import { applyAdjust, releaseTexture } from './render/adjust'
import { adjustKey, isNeutral, type Adjust, type Layer } from './types'

// Bitmaps e outros recursos não serializáveis ficam fora do estado do React.

const MAX_SOURCE = 2048
const MAX_BRUSH = 1024

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Decodifica uma imagem para um canvas, limitando o lado maior a `max`. */
export async function decodeImage(blob: Blob, max = MAX_SOURCE): Promise<HTMLCanvasElement> {
  const draw = (img: CanvasImageSource, w: number, h: number) => {
    const k = Math.min(1, max / Math.max(w, h))
    const c = makeCanvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)))
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c
  }
  try {
    const bmp = await createImageBitmap(blob)
    try {
      return draw(bmp, bmp.width, bmp.height)
    } finally {
      bmp.close()
    }
  } catch {
    // SVG e afins: createImageBitmap não aceita, <img> sim. Usa onload em vez
    // de decode(), que fica pendente enquanto a aba está em segundo plano.
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = () => rej(new Error('Imagem inválida'))
        img.src = url
      })
      return draw(img, img.naturalWidth || 512, img.naturalHeight || 512)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export const canvasBlob = (c: HTMLCanvasElement, type = 'image/png', quality?: number) =>
  new Promise<Blob>((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao codificar a imagem'))), type, quality),
  )

export function makeThumb(source: CanvasImageSource, w: number, h: number, size = 64): string {
  const c = makeCanvas(size, size)
  const k = Math.min(size / w, size / h)
  c.getContext('2d')!.drawImage(source, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k)
  return c.toDataURL()
}

/** Cache do bitmap com ajustes de cor aplicados, recalculado só quando o ajuste muda. */
export interface Adjustable {
  adjusted?: HTMLCanvasElement
  adjustedKey?: string
}

export function adjustedImage(source: HTMLCanvasElement, adjust: Adjust, cache: Adjustable) {
  if (isNeutral(adjust)) return source
  const key = adjustKey(adjust)
  if (cache.adjustedKey !== key) {
    const out = applyAdjust(source, adjust, cache.adjusted)
    if (!out) return source
    cache.adjusted = out
    cache.adjustedKey = key
  }
  return cache.adjusted ?? source
}

export interface LayerRes extends Adjustable {
  source: HTMLCanvasElement
  blob: Blob
  thumb: string
  brush?: HTMLCanvasElement
}

export const layerRes = new Map<string, LayerRes>()

export function layerImage(layer: Layer): HTMLCanvasElement | null {
  const r = layerRes.get(layer.id)
  return r ? adjustedImage(r.source, layer.adjust, r) : null
}

/** Máscara pintada da transposição, no espaço da imagem da camada. */
export function brushMask(id: string, create = false): HTMLCanvasElement | null {
  const r = layerRes.get(id)
  if (!r) return null
  if (!r.brush && create) {
    const k = Math.min(1, MAX_BRUSH / Math.max(r.source.width, r.source.height))
    r.brush = makeCanvas(Math.round(r.source.width * k), Math.round(r.source.height * k))
  }
  return r.brush ?? null
}

export function disposeLayer(id: string) {
  const r = layerRes.get(id)
  if (r) releaseTexture(r.source)
  layerRes.delete(id)
}
