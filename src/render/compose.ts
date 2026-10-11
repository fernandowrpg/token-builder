import { frameRing, getFrame } from '../frames/registry'
import { brushMask, layerImage } from '../resources'
import type { FrameState, Layer } from '../types'

type Ctx = CanvasRenderingContext2D

const scratch = document.createElement('canvas')

function scratchCtx(S: number): Ctx {
  if (scratch.width !== S) scratch.width = scratch.height = S
  const c = scratch.getContext('2d')!
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.globalCompositeOperation = 'source-over'
  c.globalAlpha = 1
  c.clearRect(0, 0, S, S)
  c.imageSmoothingQuality = 'high'
  return c
}

/** Tamanho desenhado da camada em um canvas de lado S. */
export function layerSize(layer: Layer, srcW: number, srcH: number, S: number) {
  const k = (layer.scale * S) / Math.min(srcW, srcH)
  return { w: srcW * k * layer.aspect, h: srcH * k }
}

/** Leva a origem ao centro da camada, com rotação e espelhamento aplicados. */
export function applyLayerTransform(c: Ctx, layer: Layer, S: number) {
  c.translate(S / 2 + layer.x * S, S / 2 + layer.y * S)
  c.rotate((layer.rotation * Math.PI) / 180)
  if (layer.flipX) c.scale(-1, 1)
}

function drawInLayerSpace(c: Ctx, layer: Layer, S: number, img: HTMLCanvasElement, ref: HTMLCanvasElement) {
  const { w, h } = layerSize(layer, ref.width, ref.height, S)
  c.save()
  applyLayerTransform(c, layer, S)
  c.drawImage(img, -w / 2, -h / 2, w, h)
  c.restore()
}

/** Desenha a imagem da camada já sem as áreas apagadas com a borracha. */
function drawLayer(c: Ctx, layer: Layer, S: number, img: HTMLCanvasElement) {
  drawInLayerSpace(c, layer, S, img, img)
  const erased = brushMask(layer.id, false, 'erase')
  if (!erased) return
  c.globalCompositeOperation = 'destination-out'
  drawInLayerSpace(c, layer, S, erased, img)
  c.globalCompositeOperation = 'source-over'
}

function drawInFrameBox(c: Ctx, img: CanvasImageSource, frame: FrameState, S: number) {
  const fs = frame.scale * S
  c.save()
  c.translate(S / 2, S / 2)
  c.rotate((frame.rotation * Math.PI) / 180)
  c.drawImage(img, -fs / 2, -fs / 2, fs, fs)
  c.restore()
}

/** Mantém no scratch só o lado da linha que deve sair da moldura. */
function keepLineSide(c: Ctx, layer: Layer, S: number) {
  const { angle, offset, feather } = layer.popout
  const a = (angle * Math.PI) / 180
  const dx = Math.sin(a)
  const dy = -Math.cos(a)
  const f = Math.max(feather, 0.002)
  const at = (t: number) => [S / 2 + dx * t * S, S / 2 + dy * t * S] as const
  const [x0, y0] = at(offset - f / 2)
  const [x1, y1] = at(offset + f / 2)
  const g = c.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,1)')
  c.globalCompositeOperation = 'destination-in'
  c.fillStyle = g
  c.fillRect(0, 0, S, S)
  c.globalCompositeOperation = 'source-over'
}

/**
 * Compõe o token em `ctx` (transformação identidade) num quadrado de lado S.
 * Ordem: fundo → camadas abaixo do aro → aro → camadas e transposições acima.
 */
export function renderToken(ctx: Ctx, S: number, layers: Layer[], frame: FrameState) {
  const entry = getFrame(frame.frameId)
  const ring = frameRing(entry, frame.adjust)
  const visible = layers.filter((l) => l.visible)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, S, S)
  ctx.imageSmoothingQuality = 'high'

  const clipToFrame = (c: Ctx) => {
    c.globalCompositeOperation = 'destination-in'
    drawInFrameBox(c, entry.mask, frame, S)
    c.globalCompositeOperation = 'source-over'
  }
  const flush = (alpha = 1, blend: GlobalCompositeOperation = 'source-over') => {
    ctx.globalAlpha = alpha
    ctx.globalCompositeOperation = blend
    ctx.drawImage(scratch, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  if (frame.bgEnabled) {
    const c = scratchCtx(S)
    c.fillStyle = frame.bgColor
    c.fillRect(0, 0, S, S)
    clipToFrame(c)
    flush()
  }

  for (const layer of visible) {
    const img = layerImage(layer)
    if (!img || layer.placement === 'front') continue
    const c = scratchCtx(S)
    drawLayer(c, layer, S, img)
    if (layer.placement !== 'behind') clipToFrame(c)
    flush(layer.opacity, layer.blend)
  }

  if (ring) {
    ctx.globalAlpha = frame.opacity
    drawInFrameBox(ctx, ring, frame, S)
    ctx.globalAlpha = 1
  }

  for (const layer of visible) {
    const img = layerImage(layer)
    if (!img) continue
    if (layer.placement === 'front') {
      const c = scratchCtx(S)
      drawLayer(c, layer, S, img)
      flush(layer.opacity, layer.blend)
    } else if (layer.placement === 'popout') {
      const c = scratchCtx(S)
      drawLayer(c, layer, S, img)
      if (layer.popout.mode === 'line') {
        keepLineSide(c, layer, S)
      } else {
        const mask = brushMask(layer.id)
        if (!mask) continue
        c.globalCompositeOperation = 'destination-in'
        drawInLayerSpace(c, layer, S, mask, img)
        c.globalCompositeOperation = 'source-over'
      }
      flush(layer.opacity)
    }
  }
}
