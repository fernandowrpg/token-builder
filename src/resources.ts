import { applyAdjust, releaseTexture } from './render/adjust'
import { adjustKey, isNeutral, type Adjust, type ColorKey, type Layer } from './types'

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

export function adjustedImage(
  source: HTMLCanvasElement,
  adjust: Adjust,
  cache: Adjustable,
  colorKey?: ColorKey,
  version = '', // identifica o conteúdo de `source` quando ele não é a imagem original
) {
  const ck = colorKey?.enabled && !colorKey.contiguous ? colorKey : undefined
  if (isNeutral(adjust) && !ck) return source
  const key = adjustKey(adjust) + (ck ? `|${ck.color}|${ck.tolerance}|${ck.softness}` : '') + version
  if (cache.adjustedKey !== key) {
    const out = applyAdjust(source, adjust, cache.adjusted, ck)
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
  brush?: HTMLCanvasElement // áreas que saem da moldura
  erase?: HTMLCanvasElement // áreas apagadas com a borracha
  keyed?: HTMLCanvasElement // imagem com o fundo conectado removido
  keyedKey?: string
}

export type MaskKind = 'brush' | 'erase'

export const layerRes = new Map<string, LayerRes>()

const MAX_DIST = 255 * Math.sqrt(3)

/**
 * Remove o fundo só nas regiões ligadas aos pontos clicados (varinha mágica):
 * a partir de cada ponto, espalha pelos vizinhos de cor parecida com a dele,
 * sem atravessar contornos. Assim a mesma cor dentro do personagem é mantida.
 */
function floodKeyed(r: LayerRes, key: ColorKey): HTMLCanvasElement {
  const seeds = key.seeds ?? []
  const id = `${key.tolerance}|${key.softness}|${seeds.map((s) => `${s.u},${s.v}`).join(';')}`
  if (r.keyed && r.keyedKey === id) return r.keyed
  const { width: w, height: h } = r.source
  const img = r.source.getContext('2d')!.getImageData(0, 0, w, h)
  const d = img.data
  const lo = key.tolerance * MAX_DIST
  const hi = (key.tolerance + key.softness) * MAX_DIST + 0.5
  const seen = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  for (const s of seeds) {
    const si = Math.min(h - 1, Math.max(0, Math.floor(s.v * h))) * w + Math.min(w - 1, Math.max(0, Math.floor(s.u * w)))
    const kr = d[si * 4]
    const kg = d[si * 4 + 1]
    const kb = d[si * 4 + 2]
    let n = 0
    const visit = (i: number) => {
      if (seen[i]) return
      const o = i * 4
      const dist = Math.sqrt((d[o] - kr) ** 2 + (d[o + 1] - kg) ** 2 + (d[o + 2] - kb) ** 2)
      if (dist > hi && d[o + 3] > 8) return
      seen[i] = 1
      const t = Math.min(1, Math.max(0, (dist - lo) / (hi - lo)))
      d[o + 3] *= t * t * (3 - 2 * t)
      // a faixa de transição suaviza a borda, mas não propaga: evita vazar pelo contorno
      if (dist <= lo || d[o + 3] <= 8) stack[n++] = i
    }
    visit(si)
    while (n) {
      const i = stack[--n]
      const x = i % w
      if (x > 0) visit(i - 1)
      if (x < w - 1) visit(i + 1)
      if (i >= w) visit(i - w)
      if (i < w * (h - 1)) visit(i + w)
    }
  }
  if (r.keyed) releaseTexture(r.keyed) // o conteúdo mudou; a textura em cache ficou velha
  r.keyed ??= makeCanvas(w, h)
  r.keyed.getContext('2d')!.putImageData(img, 0, 0)
  r.keyedKey = id
  return r.keyed
}

export function layerImage(layer: Layer): HTMLCanvasElement | null {
  const r = layerRes.get(layer.id)
  if (!r) return null
  const k = layer.key
  if (k?.enabled && k.contiguous && k.seeds?.length)
    return adjustedImage(floodKeyed(r, k), layer.adjust, r, undefined, `|flood|${r.keyedKey}`)
  return adjustedImage(r.source, layer.adjust, r, k)
}

/** Máscara pintada (transposição ou borracha), no espaço da imagem da camada. */
export function brushMask(id: string, create = false, kind: MaskKind = 'brush'): HTMLCanvasElement | null {
  const r = layerRes.get(id)
  if (!r) return null
  if (!r[kind] && create) {
    const k = Math.min(1, MAX_BRUSH / Math.max(r.source.width, r.source.height))
    r[kind] = makeCanvas(Math.round(r.source.width * k), Math.round(r.source.height * k))
  }
  return r[kind] ?? null
}

export function disposeLayer(id: string) {
  const r = layerRes.get(id)
  if (r) releaseTexture(r.source)
  if (r?.keyed) releaseTexture(r.keyed)
  layerRes.delete(id)
}
