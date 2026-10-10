import { brushMask } from '../resources'
import { actions, setState, useStore } from '../store'
import type { Layer, Placement, Popout } from '../types'
import { AdjustControls, Section, Slider } from './Controls'

const PLACEMENTS: [Placement, string][] = [
  ['inside', 'Dentro da moldura'],
  ['popout', 'Transposição (sai da moldura)'],
  ['behind', 'Atrás da moldura, sem recorte'],
  ['front', 'À frente da moldura, sem recorte'],
]

const BLENDS: [GlobalCompositeOperation, string][] = [
  ['source-over', 'Normal'],
  ['multiply', 'Multiplicar'],
  ['screen', 'Tela'],
  ['overlay', 'Sobrepor'],
  ['soft-light', 'Luz suave'],
  ['hard-light', 'Luz direta'],
  ['color-dodge', 'Subexposição'],
  ['lighter', 'Adição'],
  ['color', 'Cor'],
  ['luminosity', 'Luminosidade'],
]

export function LayerProps() {
  const layer = useStore((s) => s.layers.find((l) => l.id === s.selectedId) ?? null)
  const frameScale = useStore((s) => s.frame.scale)
  const tool = useStore((s) => s.tool)
  const brushSize = useStore((s) => s.brushSize)
  const brushErase = useStore((s) => s.brushErase)

  if (!layer) return <p className="hint">Selecione uma camada para editar suas propriedades.</p>

  const set = (patch: Partial<Layer>) => actions.updateLayer(layer.id, patch)
  const setPopout = (patch: Partial<Popout>) => {
    set({ popout: { ...layer.popout, ...patch } })
    if (patch.mode === 'line') setState({ tool: 'move' })
  }
  const fillBrush = (fill: boolean) => {
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

  return (
    <>
      <Section title="Camada">
        <input className="text" value={layer.name} onChange={(e) => set({ name: e.target.value })} />
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
            <button className={layer.popout.mode === 'line' ? 'on' : ''} onClick={() => setPopout({ mode: 'line' })}>
              Linha de corte
            </button>
            <button className={layer.popout.mode === 'brush' ? 'on' : ''} onClick={() => setPopout({ mode: 'brush' })}>
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
              <button
                className={tool === 'brush' ? 'primary wide' : 'wide'}
                onClick={() => setState({ tool: tool === 'brush' ? 'move' : 'brush' })}
              >
                {tool === 'brush' ? 'Concluir pintura' : 'Pintar no token'}
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

      <Section title="Enquadramento">
        <Slider
          label="Escala"
          value={layer.scale * 100}
          min={5}
          max={400}
          def={frameScale * 100}
          unit="%"
          onChange={(v) => set({ scale: v / 100 })}
        />
        <Slider
          label="Proporção"
          value={layer.aspect * 100}
          min={50}
          max={200}
          def={100}
          unit="%"
          onChange={(v) => set({ aspect: v / 100 })}
        />
        <Slider
          label="Rotação"
          value={layer.rotation}
          min={-180}
          max={180}
          def={0}
          unit="°"
          onChange={(v) => set({ rotation: v })}
        />
        <Slider label="Posição X" value={layer.x * 100} min={-100} max={100} def={0} unit="%" onChange={(v) => set({ x: v / 100 })} />
        <Slider label="Posição Y" value={layer.y * 100} min={-100} max={100} def={0} unit="%" onChange={(v) => set({ y: v / 100 })} />
        <div className="row">
          <button className="small" onClick={() => set({ flipX: !layer.flipX })}>
            Espelhar
          </button>
          <button className="small" onClick={() => set({ x: 0, y: 0, scale: frameScale, aspect: 1, rotation: 0 })}>
            Ajustar à moldura
          </button>
        </div>
      </Section>

      <Section title="Aparência">
        <Slider
          label="Opacidade"
          value={layer.opacity * 100}
          min={0}
          max={100}
          def={100}
          unit="%"
          onChange={(v) => set({ opacity: v / 100 })}
        />
        <div className="row">
          <span className="slider-label">Mesclagem</span>
          <select value={layer.blend} onChange={(e) => set({ blend: e.target.value as GlobalCompositeOperation })}>
            {BLENDS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <AdjustControls value={layer.adjust} onChange={(adjust) => set({ adjust })} />
      </Section>
    </>
  )
}
