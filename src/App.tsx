import { useEffect, useState } from 'react'
import { FramePanel } from './components/FramePanel'
import { LayerProps } from './components/LayerProps'
import { LayersPanel } from './components/LayersPanel'
import { Viewport } from './components/Viewport'
import { addFiles, deleteLayer, exportToken, initApp, newProject } from './project'
import { actions, getState, setState, useStore } from './store'
import type { ExportFormat } from './types'

const SIZES = [140, 256, 280, 400, 512, 1024, 2048]

function TopBar() {
  const exportSize = useStore((s) => s.exportSize)
  const exportFormat = useStore((s) => s.exportFormat)
  const frameScale = useStore((s) => s.frame.scale)
  const empty = useStore((s) => s.layers.length === 0)

  return (
    <header className="topbar">
      <h1>Token Builder</h1>
      <button
        onClick={() => {
          if (empty || confirm('Descartar o token atual e começar um novo?')) newProject()
        }}
      >
        Novo token
      </button>
      <div className="spacer" />
      {frameScale < 1 && (
        <span className="scale-hint" title="A moldura ocupa só parte do canvas para sobrar espaço à transposição.">
          Moldura em {Math.round(frameScale * 100)}% do canvas · no Foundry, use escala de imagem{' '}
          {(1 / frameScale).toFixed(2)}
        </span>
      )}
      <select value={exportSize} onChange={(e) => setState({ exportSize: Number(e.target.value) })}>
        {SIZES.map((s) => (
          <option key={s} value={s}>
            {s} × {s} px
          </option>
        ))}
      </select>
      <select value={exportFormat} onChange={(e) => setState({ exportFormat: e.target.value as ExportFormat })}>
        <option value="png">PNG (Roll20 / Foundry)</option>
        <option value="webp">WebP (Foundry)</option>
      </select>
      <button className="primary" onClick={() => exportToken().catch((err) => alert(String(err)))}>
        Exportar
      </button>
    </header>
  )
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')

export function App() {
  const [tab, setTab] = useState<'layer' | 'frame'>('layer')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initApp().then(() => setReady(true))
  }, [])

  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer?.files.length) addFiles(Array.from(e.dataTransfer.files))
    }
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.length && !isTyping(e.target)) addFiles(files)
    }
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const s = getState()
      const layer = s.layers.find((l) => l.id === s.selectedId)
      if (!layer) return
      const step = e.shiftKey ? 0.02 : 0.004
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      if (e.key === 'Delete') deleteLayer(layer.id)
      else if (nudge[e.key]) actions.updateLayer(layer.id, { x: layer.x + nudge[e.key][0], y: layer.y + nudge[e.key][1] })
      else return
      e.preventDefault()
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!ready) return <div className="loading">Carregando…</div>

  return (
    <div className="app">
      <TopBar />
      <LayersPanel />
      <Viewport />
      <aside className="panel right">
        <div className="tabs">
          <button className={tab === 'layer' ? 'on' : ''} onClick={() => setTab('layer')}>
            Camada
          </button>
          <button className={tab === 'frame' ? 'on' : ''} onClick={() => setTab('frame')}>
            Moldura
          </button>
        </div>
        <div className="panel-body">{tab === 'layer' ? <LayerProps /> : <FramePanel />}</div>
      </aside>
    </div>
  )
}
