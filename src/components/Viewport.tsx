import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { applyLayerTransform, layerSize, renderToken } from '../render/compose'
import { brushMask, layerRes } from '../resources'
import { actions, beginBrushEdit, getState, setState, useStore, type AppState } from '../store'
import { DEFAULT_KEY, type Layer } from '../types'

interface Point {
  x: number
  y: number
}

type Drag = { kind: 'move'; start: Point; x: number; y: number } | { kind: 'brush'; last: Point }

const selectedLayer = (s: AppState) => s.layers.find((l) => l.id === s.selectedId) ?? null

/** Ponto do canvas → posição na imagem da camada, de 0 a 1 em cada eixo. */
function toImage(layer: Layer, p: Point) {
  const src = layerRes.get(layer.id)?.source
  if (!src) return null
  const { w, h } = layerSize(layer, src.width, src.height, 1)
  const a = (-layer.rotation * Math.PI) / 180
  const dx = p.x - layer.x
  const dy = p.y - layer.y
  const lx = dx * Math.cos(a) - dy * Math.sin(a)
  const ly = dx * Math.sin(a) + dy * Math.cos(a)
  return { u: (layer.flipX ? -lx : lx) / w + 0.5, v: ly / h + 0.5, src }
}

function hit(layer: Layer, p: Point) {
  const at = layer.visible && toImage(layer, p)
  return !!at && at.u >= 0 && at.u <= 1 && at.v >= 0 && at.v <= 1
}

/** Cor do pixel original da camada sob o ponto; null fora dela ou em área transparente. */
function pickColor(layer: Layer, p: Point) {
  const at = toImage(layer, p)
  if (!at || at.u < 0 || at.u >= 1 || at.v < 0 || at.v >= 1) return null
  const x = Math.floor(at.u * at.src.width)
  const y = Math.floor(at.v * at.src.height)
  const [r, g, b, alpha] = at.src.getContext('2d')!.getImageData(x, y, 1, 1).data
  return alpha ? '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('') : null
}

/** Pinta (ou apaga) um traço na máscara de transposição, em coordenadas do canvas. */
function paint(layer: Layer, from: Point, to: Point, size: number, erase: boolean) {
  const mask = brushMask(layer.id, true)
  const src = layerRes.get(layer.id)?.source
  if (!mask || !src) return
  const { w, h } = layerSize(layer, src.width, src.height, 1)
  const c = mask.getContext('2d')!
  c.save()
  // inverso da transformação da camada: canvas → pixels da máscara
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.scale(mask.width / w, mask.height / h)
  c.translate(w / 2, h / 2)
  if (layer.flipX) c.scale(-1, 1)
  c.rotate((-layer.rotation * Math.PI) / 180)
  c.translate(-layer.x, -layer.y)
  c.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
  c.fillStyle = c.strokeStyle = '#ff2bd6'
  c.lineCap = c.lineJoin = 'round'
  c.lineWidth = size
  c.beginPath()
  c.moveTo(from.x, from.y)
  c.lineTo(to.x, to.y)
  c.stroke()
  c.beginPath()
  c.arc(to.x, to.y, size / 2, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

function drawOverlay(ctx: CanvasRenderingContext2D, S: number, s: AppState) {
  const layer = selectedLayer(s)
  const src = layer && layerRes.get(layer.id)?.source
  if (!layer || !src) return
  const { w, h } = layerSize(layer, src.width, src.height, S)
  const line = Math.max(1, S / 500)

  if (s.tool === 'brush') {
    const mask = brushMask(layer.id)
    if (mask) {
      ctx.save()
      ctx.globalAlpha = 0.4
      applyLayerTransform(ctx, layer, S)
      ctx.drawImage(mask, -w / 2, -h / 2, w, h)
      ctx.restore()
    }
  }

  ctx.save()
  applyLayerTransform(ctx, layer, S)
  ctx.lineWidth = line
  ctx.strokeStyle = 'rgba(0,0,0,.6)'
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.setLineDash([line * 5, line * 5])
  ctx.strokeStyle = '#fff'
  ctx.strokeRect(-w / 2, -h / 2, w, h)
  ctx.restore()

  if (layer.placement === 'popout' && layer.popout.mode === 'line') {
    const a = (layer.popout.angle * Math.PI) / 180
    const dx = Math.sin(a)
    const dy = -Math.cos(a)
    const cx = S / 2 + dx * layer.popout.offset * S
    const cy = S / 2 + dy * layer.popout.offset * S
    ctx.save()
    ctx.lineWidth = line * 1.5
    ctx.setLineDash([line * 8, line * 6])
    ctx.strokeStyle = '#ff2bd6'
    ctx.beginPath()
    ctx.moveTo(cx + dy * S, cy - dx * S)
    ctx.lineTo(cx - dy * S, cy + dx * S)
    ctx.stroke()
    ctx.restore()
  }
}

export function Viewport() {
  const state = useStore((s) => s)
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const cursor = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const [size, setSize] = useState(480)

  useEffect(() => {
    const el = wrap.current!
    const ro = new ResizeObserver(() =>
      setSize(Math.max(160, Math.floor(Math.min(el.clientWidth, el.clientHeight)) - 32)),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const c = canvas.current!
    const px = Math.round(size * (window.devicePixelRatio || 1))
    if (c.width !== px) c.width = c.height = px
    const ctx = c.getContext('2d')!
    renderToken(ctx, px, state.layers, state.frame)
    drawOverlay(ctx, px, state)
  })

  useEffect(() => {
    const c = canvas.current!
    const onWheel = (e: WheelEvent) => {
      const layer = selectedLayer(getState())
      if (!layer) return
      e.preventDefault()
      const d = e.deltaY || e.deltaX
      if (e.shiftKey) {
        const r = layer.rotation + Math.sign(d) * 2
        actions.updateLayer(layer.id, { rotation: ((((r + 180) % 360) + 360) % 360) - 180 })
      } else {
        actions.updateLayer(layer.id, { scale: Math.min(4, Math.max(0.05, layer.scale * Math.exp(-d * 0.001))) })
      }
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  }, [])

  const toPoint = (e: PointerEvent): Point => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 }
  }

  const moveCursor = (e: PointerEvent) => {
    const el = cursor.current
    if (!el) return
    const r = canvas.current!.getBoundingClientRect()
    el.style.left = `${e.clientX - r.left}px`
    el.style.top = `${e.clientY - r.top}px`
  }

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    const s = getState()
    const p = toPoint(e)
    let layer = selectedLayer(s)
    if (s.tool === 'pick' && layer) {
      const at = toImage(layer, p)
      const color = pickColor(layer, p)
      if (at && color) {
        const key = { ...(layer.key ?? DEFAULT_KEY), color, enabled: true }
        // no modo "só o fundo" cada clique soma uma área, então a ferramenta continua ativa
        if (key.contiguous) key.seeds = [...(key.seeds ?? []), { u: at.u, v: at.v }]
        else setState({ tool: 'move' })
        actions.updateLayer(layer.id, { key })
      }
      return
    }
    if (s.tool === 'brush' && layer) {
      beginBrushEdit(layer.id)
      paint(layer, p, p, s.brushSize, s.brushErase)
      drag.current = { kind: 'brush', last: p }
      actions.touch()
    } else {
      // mantém a seleção atual se o clique cair nela; senão escolhe a camada mais acima
      if (!layer || !hit(layer, p)) {
        const top = [...s.layers].reverse().find((l) => hit(l, p))
        if (top) {
          actions.select(top.id)
          layer = top
        }
      }
      if (!layer) return
      drag.current = { kind: 'move', start: p, x: layer.x, y: layer.y }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMove = (e: PointerEvent) => {
    moveCursor(e)
    const d = drag.current
    if (!d) return
    const s = getState()
    const layer = selectedLayer(s)
    if (!layer) return
    const p = toPoint(e)
    if (d.kind === 'move') {
      actions.updateLayer(layer.id, { x: d.x + p.x - d.start.x, y: d.y + p.y - d.start.y })
    } else {
      paint(layer, d.last, p, s.brushSize, s.brushErase)
      d.last = p
      actions.touch()
    }
  }

  const brushing = state.tool === 'brush'

  return (
    <main className="viewport" ref={wrap}>
      <div className={`stage ${state.tool === 'move' ? '' : 'brushing'}`} style={{ width: size, height: size }}>
        <canvas
          ref={canvas}
          style={{ width: size, height: size }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        />
        {brushing && (
          <div
            ref={cursor}
            className="brush-cursor"
            style={{ width: state.brushSize * size, height: state.brushSize * size }}
          />
        )}
      </div>
      <p className="viewport-hint">
        {state.tool === 'pick'
          ? 'Clique na imagem sobre o fundo que deve sumir'
          : brushing
          ? 'Pinte as áreas que saem da moldura'
          : 'Arraste para mover · roda do mouse para escalar · Shift + roda para girar'}
      </p>
    </main>
  )
}
