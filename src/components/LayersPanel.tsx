import { addFiles, deleteLayer } from '../project'
import { layerRes } from '../resources'
import { actions, useStore } from '../store'
import type { Placement } from '../types'

const BADGE: Record<Placement, string> = {
  inside: 'dentro',
  behind: 'atrás',
  front: 'frente',
  popout: 'transposição',
}

export function LayersPanel() {
  const layers = useStore((s) => s.layers)
  const selectedId = useStore((s) => s.selectedId)

  return (
    <aside className="panel left">
      <div className="panel-head">
        <h2>Camadas</h2>
        <label className="button primary">
          + Imagem
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(Array.from(e.target.files))
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {layers.length === 0 && (
        <p className="hint">
          Adicione uma imagem, arraste arquivos para a janela ou cole com Ctrl+V. Para a transposição, use artes com
          fundo transparente.
        </p>
      )}

      <ul className="layers">
        {[...layers].reverse().map((l, i) => (
          <li key={l.id} className={l.id === selectedId ? 'selected' : ''} onClick={() => actions.select(l.id)}>
            <button
              className={`icon ${l.visible ? '' : 'off'}`}
              title={l.visible ? 'Ocultar' : 'Mostrar'}
              onClick={(e) => {
                e.stopPropagation()
                actions.updateLayer(l.id, { visible: !l.visible })
              }}
            >
              {l.visible ? '●' : '○'}
            </button>
            <img src={layerRes.get(l.id)?.thumb} alt="" />
            <div className="layer-name">
              <span>{l.name}</span>
              <small>{BADGE[l.placement]}</small>
            </div>
            <button
              className="icon"
              title="Subir"
              disabled={i === 0}
              onClick={(e) => {
                e.stopPropagation()
                actions.moveLayer(l.id, 1)
              }}
            >
              ▲
            </button>
            <button
              className="icon"
              title="Descer"
              disabled={i === layers.length - 1}
              onClick={(e) => {
                e.stopPropagation()
                actions.moveLayer(l.id, -1)
              }}
            >
              ▼
            </button>
            <button
              className="icon"
              title="Excluir camada"
              onClick={(e) => {
                e.stopPropagation()
                deleteLayer(l.id)
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
