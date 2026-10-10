export interface Adjust {
  hue: number // graus, -180..180
  saturation: number // 1 = original
  brightness: number // 1 = original
  contrast: number // 1 = original
  tint: string // #rrggbb
  tintAmount: number // 0..1
}

export const DEFAULT_ADJUST: Adjust = {
  hue: 0,
  saturation: 1,
  brightness: 1,
  contrast: 1,
  tint: '#3f8cff',
  tintAmount: 0,
}

export const isNeutral = (a: Adjust) =>
  a.hue === 0 && a.saturation === 1 && a.brightness === 1 && a.contrast === 1 && a.tintAmount === 0

export const adjustKey = (a: Adjust) =>
  `${a.hue}|${a.saturation}|${a.brightness}|${a.contrast}|${a.tint}|${a.tintAmount}`

/**
 * inside: recortada pela moldura, abaixo do aro
 * behind: sem recorte, abaixo do aro (asas, auras)
 * front:  sem recorte, acima do aro
 * popout: recortada abaixo do aro + região de transposição acima dele
 */
export type Placement = 'inside' | 'behind' | 'front' | 'popout'

export interface Popout {
  mode: 'line' | 'brush'
  angle: number // graus; 0 = a parte de cima sai da moldura
  offset: number // posição da linha, fração do canvas a partir do centro
  feather: number // largura da transição, fração do canvas
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number
  x: number // centro, fração do canvas a partir do centro
  y: number
  scale: number // lado menor da imagem como fração do canvas
  aspect: number // esticamento horizontal
  rotation: number // graus
  flipX: boolean
  blend: GlobalCompositeOperation
  adjust: Adjust
  placement: Placement
  popout: Popout
}

export interface FrameState {
  frameId: string
  scale: number // fração do canvas ocupada pela moldura
  rotation: number
  opacity: number
  adjust: Adjust
  bgEnabled: boolean
  bgColor: string
}

export type ExportFormat = 'png' | 'webp'
export type MaskMode = 'auto' | 'circle' | 'square'
