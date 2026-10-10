import { useSyncExternalStore } from 'react'
import { disposeLayer, layerRes, makeCanvas } from './resources'
import { DEFAULT_ADJUST, type ExportFormat, type FrameState, type Layer } from './types'

export interface AppState {
  layers: Layer[] // índice 0 = camada do fundo
  frame: FrameState
  selectedId: string | null
  tool: 'move' | 'brush' | 'pick'
  brushSize: number // diâmetro, fração do canvas
  brushErase: boolean
  exportSize: number
  exportFormat: ExportFormat
  tick: number // incrementa quando algo fora do estado muda (pincel, galeria)
}

export const initialFrame = (): FrameState => ({
  frameId: 'gold-ring',
  scale: 0.8,
  rotation: 0,
  opacity: 1,
  adjust: { ...DEFAULT_ADJUST },
  bgEnabled: true,
  bgColor: '#2b3040',
})

let state: AppState = {
  layers: [],
  frame: initialFrame(),
  selectedId: null,
  tool: 'move',
  brushSize: 0.08,
  brushErase: false,
  exportSize: 512,
  exportFormat: 'png',
  tick: 0,
}

const listeners = new Set<() => void>()

export const getState = () => state

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// ---- desfazer / refazer ----

/** Estado do projeto num ponto do histórico. As referências são imutáveis, então guardar é barato. */
interface Snap {
  layers: Layer[]
  frame: FrameState
  selectedId: string | null
  brush?: { id: string; image: HTMLCanvasElement | null } // máscara de pincel naquele momento
}

const LIMIT = 100
const BRUSH_LIMIT = 20 // cada cópia de máscara ocupa alguns MB
const MERGE_MS = 500 // mudanças mais próximas que isso (arrastar um controle) viram um passo só
const past: Snap[] = []
const future: Snap[] = []
let lastChange = 0
let replaying = false

function copyBrush(id: string) {
  const src = layerRes.get(id)?.brush
  if (!src) return null
  const c = makeCanvas(src.width, src.height)
  c.getContext('2d')!.drawImage(src, 0, 0)
  return c
}

const snap = (brushId?: string): Snap => ({
  layers: state.layers,
  frame: state.frame,
  selectedId: state.selectedId,
  brush: brushId ? { id: brushId, image: copyBrush(brushId) } : undefined,
})

function record(s: Snap) {
  past.push(s)
  while (past.length > LIMIT || past.filter((p) => p.brush).length > BRUSH_LIMIT) past.shift()
  future.length = 0
}

/** Libera imagens de camadas que nem o estado atual nem o histórico usam mais. */
function collect() {
  const used = new Set<string>()
  for (const s of [state, ...past, ...future]) for (const l of s.layers) used.add(l.id)
  for (const id of [...layerRes.keys()]) if (!used.has(id)) disposeLayer(id)
}

/** Faz a próxima mudança virar um passo próprio, mesmo logo após outra. */
const step = () => (lastChange = 0)

/** Registra o estado antes de um traço de pincel, que altera a máscara fora do estado. */
export function beginBrushEdit(layerId: string) {
  record(snap(layerId))
  step()
}

function replay(from: Snap[], to: Snap[]) {
  const s = from.pop()
  if (!s) return
  to.push(snap(s.brush?.id))
  if (s.brush) {
    const r = layerRes.get(s.brush.id)
    if (r) r.brush = s.brush.image ?? undefined
  }
  const sel = s.layers.find((l) => l.id === s.selectedId)
  const canBrush = sel?.placement === 'popout' && sel.popout.mode === 'brush'
  const keepTool = sel && s.selectedId === state.selectedId && (state.tool !== 'brush' || canBrush)
  replaying = true
  setState({
    layers: s.layers,
    frame: s.frame,
    selectedId: s.selectedId,
    tool: keepTool ? state.tool : 'move',
    tick: state.tick + 1,
  })
  replaying = false
  step()
}

export const undo = () => replay(past, future)
export const redo = () => replay(future, past)

export function resetHistory() {
  past.length = future.length = 0
  step()
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const next = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  const edited = !replaying && (next.layers !== state.layers || next.frame !== state.frame)
  if (edited) {
    const now = performance.now()
    if (now - lastChange > MERGE_MS) record(snap())
    else future.length = 0
    lastChange = now
  }
  state = next
  if (edited) collect()
  listeners.forEach((fn) => fn())
}

/** O seletor deve devolver uma referência estável (fatia do estado), nunca um objeto novo. */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export const actions = {
  addLayer(layer: Layer) {
    step()
    setState((s) => ({ layers: [...s.layers, layer], selectedId: layer.id, tool: 'move' }))
  },
  updateLayer(id: string, patch: Partial<Layer>) {
    setState((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  },
  removeLayer(id: string) {
    step()
    setState((s) => ({
      layers: s.layers.filter((l) => l.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      tool: 'move',
    }))
  },
  moveLayer(id: string, dir: 1 | -1) {
    step()
    setState((s) => {
      const i = s.layers.findIndex((l) => l.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.layers.length) return {}
      const layers = [...s.layers]
      ;[layers[i], layers[j]] = [layers[j], layers[i]]
      return { layers }
    })
  },
  select(id: string | null) {
    setState({ selectedId: id, tool: 'move' })
  },
  setFrame(patch: Partial<FrameState>) {
    setState((s) => ({ frame: { ...s.frame, ...patch } }))
  },
  touch() {
    setState((s) => ({ tick: s.tick + 1 }))
  },
}
