import { initBuiltinFrames, loadCustomFrames } from './frames/registry'
import { renderToken } from './render/compose'
import { canvasBlob, decodeImage, layerRes, makeCanvas, makeThumb } from './resources'
import { actions, getState, initialFrame, resetHistory, setState, subscribe } from './store'
import { db } from './storage/db'
import { DEFAULT_ADJUST, type ExportFormat, type FrameState, type Layer } from './types'

interface SavedProject {
  layers: Layer[]
  frame: FrameState
  selectedId: string | null
  exportSize: number
  exportFormat: ExportFormat
  images: Record<string, Blob>
  brushes: Record<string, Blob>
}

export async function addImageLayer(blob: Blob, name: string) {
  const source = await decodeImage(blob)
  const id = crypto.randomUUID()
  layerRes.set(id, { source, blob, thumb: makeThumb(source, source.width, source.height) })
  actions.addLayer({
    id,
    name,
    visible: true,
    opacity: 1,
    x: 0,
    y: 0,
    scale: getState().frame.scale,
    aspect: 1,
    rotation: 0,
    flipX: false,
    blend: 'source-over',
    adjust: { ...DEFAULT_ADJUST },
    placement: 'inside',
    popout: { mode: 'line', angle: 0, offset: 0, feather: 0.04 },
  })
}

export async function addFiles(files: Iterable<File>) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    try {
      await addImageLayer(file, file.name.replace(/\.[^.]+$/, '') || 'Camada')
    } catch (err) {
      console.warn(err)
      alert(`Não foi possível abrir "${file.name}" como imagem.`)
    }
  }
}

// As imagens da camada não são liberadas aqui: o histórico ainda pode
// restaurá-la, e libera sozinho o que deixar de ser alcançável.
export function deleteLayer(id: string) {
  actions.removeLayer(id)
}

export function newProject() {
  setState({ layers: [], selectedId: null, tool: 'move', frame: initialFrame() })
}

export async function exportToken() {
  const { layers, frame, exportSize, exportFormat } = getState()
  const canvas = makeCanvas(exportSize, exportSize)
  renderToken(canvas.getContext('2d')!, exportSize, layers, frame)
  const blob = await canvasBlob(canvas, `image/${exportFormat}`, 0.95)
  const name = (layers[layers.length - 1]?.name ?? 'token').replace(/[\\/:*?"<>|]/g, '_')
  downloadBlob(blob, `${name}-token.${exportFormat}`)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function saveProject() {
  const s = getState()
  const saved: SavedProject = {
    layers: s.layers,
    frame: s.frame,
    selectedId: s.selectedId,
    exportSize: s.exportSize,
    exportFormat: s.exportFormat,
    images: {},
    brushes: {},
  }
  for (const l of s.layers) {
    const r = layerRes.get(l.id)
    if (!r) continue
    saved.images[l.id] = r.blob
    if (r.brush) saved.brushes[l.id] = await canvasBlob(r.brush)
  }
  await db.put('kv', saved, 'project')
}

async function loadProject() {
  const saved = await db.get<SavedProject>('kv', 'project')
  if (!saved) return
  const layers: Layer[] = []
  for (const l of saved.layers) {
    const blob = saved.images[l.id]
    if (!blob) continue
    try {
      const source = await decodeImage(blob)
      const brushBlob = saved.brushes[l.id]
      layerRes.set(l.id, {
        source,
        blob,
        thumb: makeThumb(source, source.width, source.height),
        brush: brushBlob ? await decodeImage(brushBlob) : undefined,
      })
      layers.push(l)
    } catch (err) {
      console.warn(`Camada "${l.name}" não pôde ser restaurada`, err)
    }
  }
  setState({
    layers,
    frame: saved.frame,
    selectedId: layers.some((l) => l.id === saved.selectedId) ? saved.selectedId : null,
    exportSize: saved.exportSize,
    exportFormat: saved.exportFormat,
  })
}

let started: Promise<void> | undefined

/** Carrega molduras e o projeto salvo; depois passa a salvar automaticamente. */
export function initApp() {
  started ??= (async () => {
    initBuiltinFrames()
    try {
      await loadCustomFrames()
      await loadProject()
      resetHistory() // carregar o projeto salvo não é um passo desfazível
    } catch (err) {
      console.warn('Armazenamento local indisponível; nada será salvo', err)
    }
    let timer: number | undefined
    subscribe(() => {
      clearTimeout(timer)
      timer = window.setTimeout(() => saveProject().catch((err) => console.warn('Falha ao salvar', err)), 600)
    })
  })()
  return started
}
