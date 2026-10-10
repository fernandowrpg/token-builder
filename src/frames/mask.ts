import { makeCanvas } from '../resources'
import type { MaskMode } from '../types'

/**
 * Deriva a área interna de uma moldura: tudo que não é alcançável a partir
 * das bordas da imagem passando só por pixels transparentes. Funciona para
 * qualquer aro fechado, independente do formato.
 */
function deriveMask(ring: HTMLCanvasElement): HTMLCanvasElement {
  const w = ring.width
  const h = ring.height
  const data = ring.getContext('2d')!.getImageData(0, 0, w, h).data
  const outside = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  let n = 0
  const push = (i: number) => {
    if (!outside[i] && data[i * 4 + 3] < 128) {
      outside[i] = 1
      stack[n++] = i
    }
  }
  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    push(y * w)
    push(y * w + w - 1)
  }
  while (n) {
    const i = stack[--n]
    const x = i % w
    if (x > 0) push(i - 1)
    if (x < w - 1) push(i + 1)
    if (i >= w) push(i - w)
    if (i < w * (h - 1)) push(i + w)
  }
  // erosão de 2px para o conteúdo não vazar pela borda suavizada do aro
  for (let pass = 0; pass < 2; pass++) {
    const prev = outside.slice()
    for (let i = 0; i < prev.length; i++) {
      if (prev[i]) continue
      const x = i % w
      if (
        (x > 0 && prev[i - 1]) ||
        (x < w - 1 && prev[i + 1]) ||
        (i >= w && prev[i - w]) ||
        (i < w * (h - 1) && prev[i + w])
      )
        outside[i] = 1
    }
  }
  const mask = makeCanvas(w, h)
  const mctx = mask.getContext('2d')!
  const img = mctx.createImageData(w, h)
  for (let i = 0; i < outside.length; i++) {
    if (outside[i]) continue
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = img.data[i * 4 + 3] = 255
  }
  mctx.putImageData(img, 0, 0)
  return mask
}

export function buildMask(ring: HTMLCanvasElement, mode: MaskMode): HTMLCanvasElement {
  if (mode === 'auto') return deriveMask(ring)
  const mask = makeCanvas(ring.width, ring.height)
  const ctx = mask.getContext('2d')!
  const s = ring.width
  const inset = s * 0.03
  ctx.fillStyle = '#fff'
  if (mode === 'circle') {
    ctx.arc(s / 2, s / 2, s / 2 - inset, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillRect(inset, inset, s - inset * 2, s - inset * 2)
  }
  return mask
}
