import { actions, useStore } from '../store'
import type { Layer } from '../types'
import { AdjustControls, Section, Slider } from './Controls'

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

  if (!layer) return <p className="hint">Selecione uma camada para editar suas propriedades.</p>

  const set = (patch: Partial<Layer>) => actions.updateLayer(layer.id, patch)
  return (
    <>
      <Section title="Camada">
        <input className="text" value={layer.name} onChange={(e) => set({ name: e.target.value })} />
      </Section>

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
        <Slider
          label="Posição X"
          value={layer.x * 100}
          min={-100}
          max={100}
          def={0}
          unit="%"
          onChange={(v) => set({ x: v / 100 })}
        />
        <Slider
          label="Posição Y"
          value={layer.y * 100}
          min={-100}
          max={100}
          def={0}
          unit="%"
          onChange={(v) => set({ y: v / 100 })}
        />
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
