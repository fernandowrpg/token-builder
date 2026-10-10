import { useSyncExternalStore } from 'react'
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

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  listeners.forEach((fn) => fn())
}

/** O seletor deve devolver uma referência estável (fatia do estado), nunca um objeto novo. */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export const actions = {
  addLayer(layer: Layer) {
    setState((s) => ({ layers: [...s.layers, layer], selectedId: layer.id, tool: 'move' }))
  },
  updateLayer(id: string, patch: Partial<Layer>) {
    setState((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  },
  removeLayer(id: string) {
    setState((s) => ({
      layers: s.layers.filter((l) => l.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      tool: 'move',
    }))
  },
  moveLayer(id: string, dir: 1 | -1) {
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
