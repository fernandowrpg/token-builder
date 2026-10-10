import type { ReactNode } from 'react'
import { DEFAULT_ADJUST, isNeutral, type Adjust } from '../types'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  def?: number // valor restaurado com duplo clique no rótulo
  unit?: string
  onChange: (v: number) => void
}

export function Slider({ label, value, min, max, step = 1, def, unit = '', onChange }: SliderProps) {
  const shown = Math.round(value / step) * step
  return (
    <label className="slider">
      <span
        className="slider-label"
        title={def === undefined ? undefined : 'Duplo clique para restaurar'}
        onDoubleClick={() => def !== undefined && onChange(def)}
      >
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-value">
        {Number(shown.toFixed(2))}
        {unit}
      </span>
    </label>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export function AdjustControls({ value, onChange }: { value: Adjust; onChange: (a: Adjust) => void }) {
  const set = (patch: Partial<Adjust>) => onChange({ ...value, ...patch })
  return (
    <>
      <Slider label="Matiz" value={value.hue} min={-180} max={180} def={0} unit="°" onChange={(v) => set({ hue: v })} />
      <Slider
        label="Saturação"
        value={value.saturation * 100}
        min={0}
        max={200}
        def={100}
        unit="%"
        onChange={(v) => set({ saturation: v / 100 })}
      />
      <Slider
        label="Brilho"
        value={value.brightness * 100}
        min={0}
        max={200}
        def={100}
        unit="%"
        onChange={(v) => set({ brightness: v / 100 })}
      />
      <Slider
        label="Contraste"
        value={value.contrast * 100}
        min={0}
        max={200}
        def={100}
        unit="%"
        onChange={(v) => set({ contrast: v / 100 })}
      />
      <div className="row">
        <span className="slider-label">Colorir</span>
        <input type="color" value={value.tint} onChange={(e) => set({ tint: e.target.value })} />
        <button className="small" disabled={isNeutral(value)} onClick={() => onChange({ ...DEFAULT_ADJUST, tint: value.tint })}>
          Restaurar cor
        </button>
      </div>
      <Slider
        label="Intensidade"
        value={value.tintAmount * 100}
        min={0}
        max={100}
        def={0}
        unit="%"
        onChange={(v) => set({ tintAmount: v / 100 })}
      />
    </>
  )
}
