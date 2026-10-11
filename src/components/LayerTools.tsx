import { useState } from 'react'
import { brushMask } from '../resources'
import { actions, beginBrushEdit, setState, useStore } from '../store'
import { DEFAULT_KEY, type ColorKey, type Layer, type Placement, type Popout } from '../types'
import { Section, Slider } from './Controls'

const PLACEMENTS: [Placement, string][] = [
  ['inside', 'Dentro da moldura'],
  ['popout', 'Transposição (sai da moldura)'],
  ['behind', 'Atrás da moldura, sem recorte'],
  ['front', 'À frente da moldura, sem recorte'],
]

type Panel = 'place' | 'key' | 'erase'

const PANELS: [Panel, string, string][] = [
  ['place', 'Posição', 'Posição da camada em relação à moldura'],
  ['key', 'Fundo', 'Remover o fundo da imagem'],
  ['erase', 'Borracha', 'Apagar partes da camada'],
]

/** Ferramentas da camada selecionada, flutuando à esquerda do token. */
export function LayerTools() {
  const layer = useStore((s) => s.layers.find((l) => l.id === s.selectedId) ?? null)
  const tool = useStore((s) => s.tool)
  const brushSize = useStore((s) => s.brushSize)
  const brushErase = useStore((s) => s.brushErase)
  const [open, setOpen] = useState<Panel | null>(null)

  if (!layer) return null

  const set = (patch: Partial<Layer>) => actions.updateLayer(layer.id, patch)
  const key = layer.key ?? DEFAULT_KEY
  const setKey = (patch: Partial<ColorKey>) => set({ key: { ...key, ...patch } })
  const setPopout = (patch: Partial<Popout>) => {
    set({ popout: { ...layer.popout, ...patch } })
    if (patch.mode === 'line') setState({ tool: 'move' })
  }
  const clearErase = () => {
    const mask = brushMask(layer.id, false, 'erase')
    if (!mask) return
    beginBrushEdit(layer.id, 'erase')
    mask.getContext('2d')!.clearRect(0, 0, mask.width, mask.height)
    actions.touch()
  }
  const fillBrush = (fill: boolean) => {
    beginBrushEdit(layer.id)
    const mask = brushMask(layer.id, true)
    if (!mask) return
    const ctx = mask.getContext('2d')!
    ctx.clearRect(0, 0, mask.width, mask.height)
    if (fill) {
      ctx.fillStyle = '#ff2bd6'
      ctx.fillRect(0, 0, mask.width, mask.height)
    }
    actions.touch()
  }

  // trocar de painel encerra o pincel, a borracha ou o conta-gotas em uso
  const toggle = (p: Panel) => {
    setOpen(open === p ? null : p)
    setState({ tool: 'move' })
  }

  return (
    <div className="tools">
      <div className="tool-bar">
        {PANELS.map(([p, label, title]) => (
          <button key={p} className={open === p ? 'on' : ''} title={title} onClick={() => toggle(p)}>
            {label}
          </button>
        ))}
      </div>
      {/* com pincel, borracha ou conta-gotas em uso o painel some para não cobrir o token */}
      {tool !== 'move' && (
        <button className="primary" onClick={() => setState({ tool: 'move' })}>
          Concluir
        </button>
      )}
      {open && tool === 'move' && (
        <div className="tool-pop">
          {open === 'place' && (
            <>
              <Section title="Posição">
                <div className="row">
                  <span className="slider-label">Posição</span>
                  <select
                    value={layer.placement}
                    onChange={(e) => {
                      set({ placement: e.target.value as Placement })
                      setState({ tool: 'move' })
                    }}
                  >
                    {PLACEMENTS.map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </Section>
              {layer.placement === 'popout' && (
                <Section title="Transposição">
                  <div className="segmented">
                    <button
                      className={layer.popout.mode === 'line' ? 'on' : ''}
                      onClick={() => setPopout({ mode: 'line' })}
                    >
                      Linha de corte
                    </button>
                    <button
                      className={layer.popout.mode === 'brush' ? 'on' : ''}
                      onClick={() => setPopout({ mode: 'brush' })}
                    >
                      Pincel
                    </button>
                  </div>
                  {layer.popout.mode === 'line' ? (
                    <>
                      <p className="hint">Tudo o que está além da linha tracejada passa por cima da moldura.</p>
                      <Slider
                        label="Direção"
                        value={layer.popout.angle}
                        min={-180}
                        max={180}
                        def={0}
                        unit="°"
                        onChange={(v) => setPopout({ angle: v })}
                      />
                      <Slider
                        label="Posição"
                        value={layer.popout.offset * 100}
                        min={-50}
                        max={50}
                        def={0}
                        unit="%"
                        onChange={(v) => setPopout({ offset: v / 100 })}
                      />
                      <Slider
                        label="Suavização"
                        value={layer.popout.feather * 100}
                        min={0}
                        max={40}
                        def={4}
                        unit="%"
                        onChange={(v) => setPopout({ feather: v / 100 })}
                      />
                    </>
                  ) : (
                    <>
                      <p className="hint">Pinte sobre as partes da imagem que devem passar por cima da moldura.</p>
                      <button className="wide" onClick={() => setState({ tool: 'brush' })}>
                        Pintar no token
                      </button>
                      <div className="segmented">
                        <button className={brushErase ? '' : 'on'} onClick={() => setState({ brushErase: false })}>
                          Pintar
                        </button>
                        <button className={brushErase ? 'on' : ''} onClick={() => setState({ brushErase: true })}>
                          Apagar
                        </button>
                      </div>
                      <Slider
                        label="Tamanho"
                        value={brushSize * 100}
                        min={1}
                        max={40}
                        unit="%"
                        onChange={(v) => setState({ brushSize: v / 100 })}
                      />
                      <div className="row">
                        <button className="small" onClick={() => fillBrush(true)}>
                          Preencher tudo
                        </button>
                        <button className="small" onClick={() => fillBrush(false)}>
                          Limpar
                        </button>
                      </div>
                    </>
                  )}
                </Section>
              )}
            </>
          )}
          {open === 'key' && (
            <Section title="Remover fundo">
              <div className="segmented">
                <button className={key.contiguous ? 'on' : ''} onClick={() => setKey({ contiguous: true })}>
                  Só o fundo
                </button>
                <button className={key.contiguous ? '' : 'on'} onClick={() => setKey({ contiguous: false })}>
                  Cor na imagem inteira
                </button>
              </div>
              <p className="hint">
                {key.contiguous
                  ? 'Clique em cada área de fundo. A remoção se espalha a partir do clique e para no contorno do personagem.'
                  : 'Remove a cor escolhida em toda a imagem, inclusive dentro do personagem.'}
              </p>
              <div className="row">
                <button onClick={() => setState({ tool: 'pick' })}>Conta-gotas</button>
                {key.contiguous ? (
                  <button className="small" disabled={!key.seeds?.length} onClick={() => setKey({ seeds: [] })}>
                    Limpar {key.seeds?.length ?? 0} ponto(s)
                  </button>
                ) : (
                  <input
                    type="color"
                    value={key.color}
                    onChange={(e) => setKey({ color: e.target.value, enabled: true })}
                  />
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={key.enabled}
                    onChange={(e) => setKey({ enabled: e.target.checked })}
                  />
                  Ativo
                </label>
              </div>
              <Slider
                label="Intensidade"
                value={key.tolerance * 100}
                min={0}
                max={100}
                def={15}
                unit="%"
                onChange={(v) => setKey({ tolerance: v / 100 })}
              />
              <Slider
                label="Suavização"
                value={key.softness * 100}
                min={0}
                max={50}
                def={8}
                unit="%"
                onChange={(v) => setKey({ softness: v / 100 })}
              />
            </Section>
          )}
          {open === 'erase' && (
            <Section title="Borracha">
              <p className="hint">
                Apaga partes desta camada, inclusive da transposição. A imagem original não é alterada.
              </p>
              <button className="wide" onClick={() => setState({ tool: 'erase' })}>
                Usar borracha no token
              </button>
              <div className="segmented">
                <button className={brushErase ? '' : 'on'} onClick={() => setState({ brushErase: false })}>
                  Apagar
                </button>
                <button className={brushErase ? 'on' : ''} onClick={() => setState({ brushErase: true })}>
                  Restaurar
                </button>
              </div>
              <Slider
                label="Tamanho"
                value={brushSize * 100}
                min={1}
                max={40}
                unit="%"
                onChange={(v) => setState({ brushSize: v / 100 })}
              />
              <button className="small" onClick={clearErase}>
                Restaurar tudo
              </button>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
