import { useState } from 'react'
import {
  exportLibrary,
  getFrame,
  importLibrary,
  listFrames,
  registerFrame,
  removeFrame,
  saveVariant,
} from '../frames/registry'
import { downloadBlob } from '../project'
import { actions, useStore } from '../store'
import type { MaskMode } from '../types'
import { AdjustControls, Section, Slider } from './Controls'

interface Draft {
  file: File
  name: string
  maskMode: MaskMode
}

export function FramePanel() {
  const frame = useStore((s) => s.frame)
  useStore((s) => s.tick) // a galeria vive fora do estado; o tick avisa quando ela muda
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const current = getFrame(frame.frameId)
  const all = listFrames()
  const q = query.trim().toLowerCase()
  const frames = q ? all.filter((f) => f.name.toLowerCase().includes(q)) : all

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      console.warn(err)
      alert(err instanceof Error ? err.message : 'Operação falhou')
    } finally {
      setBusy(false)
      actions.touch()
    }
  }

  const saveDraft = () =>
    draft &&
    guard(async () => {
      const id = await registerFrame(draft.name.trim() || 'Moldura', draft.file, draft.maskMode)
      actions.setFrame({ frameId: id })
      setDraft(null)
    })

  return (
    <>
      <Section title={`Galeria (${all.length})`}>
        <input
          className="text"
          type="search"
          value={query}
          placeholder="Buscar: fogo, hexágono, arcano…"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="gallery">
          {frames.map((f) => (
            <div
              key={f.id}
              className={`frame-card ${f.id === current.id ? 'selected' : ''}`}
              title={f.name}
              onClick={() => actions.setFrame({ frameId: f.id })}
            >
              <img src={f.thumb} alt="" />
              <span>{f.name}</span>
              {!f.builtin && (
                <button
                  className="icon remove"
                  title="Excluir moldura"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Excluir a moldura "${f.name}" da galeria?`)) guard(() => removeFrame(f.id))
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {draft ? (
          <div className="draft">
            <input
              className="text"
              value={draft.name}
              placeholder="Nome da moldura"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <div className="row">
              <span className="slider-label">Área interna</span>
              <select value={draft.maskMode} onChange={(e) => setDraft({ ...draft, maskMode: e.target.value as MaskMode })}>
                <option value="auto">Detectar pelo aro</option>
                <option value="circle">Círculo</option>
                <option value="square">Quadrado</option>
              </select>
            </div>
            <div className="row">
              <button className="primary" disabled={busy} onClick={saveDraft}>
                Salvar na galeria
              </button>
              <button onClick={() => setDraft(null)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <label className="button wide">
            + Cadastrar moldura (PNG com transparência)
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setDraft({ file, name: file.name.replace(/\.[^.]+$/, ''), maskMode: 'auto' })
                e.target.value = ''
              }}
            />
          </label>
        )}

        <div className="row">
          <button
            className="small"
            disabled={busy}
            onClick={() => guard(async () => downloadBlob(await exportLibrary(), 'molduras.tokenframes.json'))}
          >
            Exportar biblioteca
          </button>
          <label className="button small">
            Importar biblioteca
            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) guard(async () => void (await importLibrary(file)))
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </Section>

      <Section title="Moldura no token">
        <Slider
          label="Tamanho"
          value={frame.scale * 100}
          min={30}
          max={100}
          def={80}
          unit="%"
          onChange={(v) => actions.setFrame({ scale: v / 100 })}
        />
        <Slider
          label="Rotação"
          value={frame.rotation}
          min={-180}
          max={180}
          def={0}
          unit="°"
          onChange={(v) => actions.setFrame({ rotation: v })}
        />
        <Slider
          label="Opacidade"
          value={frame.opacity * 100}
          min={0}
          max={100}
          def={100}
          unit="%"
          onChange={(v) => actions.setFrame({ opacity: v / 100 })}
        />
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={frame.bgEnabled} onChange={(e) => actions.setFrame({ bgEnabled: e.target.checked })} />
            Cor de fundo
          </label>
          <input
            type="color"
            value={frame.bgColor}
            disabled={!frame.bgEnabled}
            onChange={(e) => actions.setFrame({ bgColor: e.target.value })}
          />
        </div>
      </Section>

      <Section title="Cor da moldura">
        {current.ring ? (
          <>
            <AdjustControls value={frame.adjust} onChange={(adjust) => actions.setFrame({ adjust })} />
            <button
              className="wide"
              disabled={busy}
              onClick={() => {
                const name = prompt('Nome da nova moldura:', `${current.name} (variação)`)
                if (name)
                  guard(async () => {
                    const id = await saveVariant(current, frame.adjust, name)
                    // a variação já tem a cor aplicada: zera o ajuste para não aplicar duas vezes
                    if (id) actions.setFrame({ frameId: id, adjust: { ...frame.adjust, hue: 0, saturation: 1, brightness: 1, contrast: 1, tintAmount: 0 } })
                  })
              }}
            >
              Salvar esta cor como nova moldura
            </button>
          </>
        ) : (
          <p className="hint">Esta opção não tem aro para colorir.</p>
        )}
      </Section>
    </>
  )
}
