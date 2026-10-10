// Molduras padrão desenhadas por código: não dependem de arquivos de imagem
// e ficam nítidas em qualquer tamanho de exportação.

export const FRAME_SIZE = 1024
const R = FRAME_SIZE
const C = R / 2

// escala do desenho em curso; shadowBlur ignora a transformação do canvas
let K = 1

interface Metal {
  light: string
  mid: string
  dark: string
  edge: string
}

const GOLD: Metal = { light: '#fff3c4', mid: '#d6a23a', dark: '#7c5210', edge: '#2e1c04' }
const SILVER: Metal = { light: '#ffffff', mid: '#b4bcc6', dark: '#5a636e', edge: '#1d2126' }
const BRONZE: Metal = { light: '#f7cfa6', mid: '#b36e36', dark: '#5c3010', edge: '#241204' }
const IRON: Metal = { light: '#a3acb5', mid: '#59616a', dark: '#24292e', edge: '#0a0c0e' }

const metal = (h: number, s: number, l: number): Metal => ({
  light: `hsl(${h} ${s}% ${Math.min(95, l + 32)}%)`,
  mid: `hsl(${h} ${s}% ${l}%)`,
  dark: `hsl(${h} ${s}% ${Math.max(6, l - 26)}%)`,
  edge: `hsl(${h} ${s}% 7%)`,
})

type Ctx = CanvasRenderingContext2D
type PathFn = (r: number) => Path2D
type RadFn = (r: number, a: number) => number
type Pt = [radius: number, angle: number, index: number]

const circle: PathFn = (r) => {
  const p = new Path2D()
  p.arc(C, C, r, 0, Math.PI * 2)
  return p
}

const polygon =
  (n: number, rot = 0): PathFn =>
  (r) => {
    const p = new Path2D()
    for (let i = 0; i < n; i++) {
      const a = rot + (i * 2 * Math.PI) / n - Math.PI / 2
      const x = C + r * Math.cos(a)
      const y = C + r * Math.sin(a)
      if (i) p.lineTo(x, y)
      else p.moveTo(x, y)
    }
    p.closePath()
    return p
  }

/** Distância do centro até a borda do polígono na direção `a`. */
const polyRad =
  (n: number, rot = 0): RadFn =>
  (r, a) => {
    const seg = (2 * Math.PI) / n
    const t = (((a - rot + Math.PI / 2) % seg) + seg) % seg
    return (r * Math.cos(seg / 2)) / Math.cos(t - seg / 2)
  }

const roundedSquare: PathFn = (r) => {
  const p = new Path2D()
  const h = r * 0.94
  p.roundRect(C - h, C - h, h * 2, h * 2, h * 0.22)
  return p
}

const shield: PathFn = (r) => {
  const p = new Path2D()
  p.moveTo(C - 0.8 * r, C - 0.85 * r)
  p.lineTo(C + 0.8 * r, C - 0.85 * r)
  p.lineTo(C + 0.8 * r, C + 0.05 * r)
  p.bezierCurveTo(C + 0.8 * r, C + 0.6 * r, C + 0.3 * r, C + 0.85 * r, C, C + r)
  p.bezierCurveTo(C - 0.3 * r, C + 0.85 * r, C - 0.8 * r, C + 0.6 * r, C - 0.8 * r, C + 0.05 * r)
  p.closePath()
  return p
}

/** `n` pontos igualmente espaçados em ângulo sobre o contorno. */
const points = (rad: RadFn, r: number, n: number, rot = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = rot - Math.PI / 2 + (i * 2 * Math.PI) / n
    return [rad(r, a), a, i]
  })

const ringPoints = (r: number, n: number) => points((x) => x, r, n)

function diag(ctx: Ctx, stops: string[]) {
  const g = ctx.createLinearGradient(R * 0.15, R * 0.1, R * 0.85, R * 0.9)
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s))
  return g
}

/** Aro chanfrado: borda escura, corpo, sulco invertido e filete de brilho. */
function bevel(ctx: Ctx, path: Path2D, width: number, m: Metal) {
  ctx.lineJoin = 'round'
  ctx.strokeStyle = m.edge
  ctx.lineWidth = width
  ctx.stroke(path)
  ctx.strokeStyle = diag(ctx, [m.light, m.mid, m.dark])
  ctx.lineWidth = width - 8
  ctx.stroke(path)
  ctx.strokeStyle = diag(ctx, [m.dark, m.mid, m.light])
  ctx.lineWidth = width * 0.5
  ctx.stroke(path)
  ctx.strokeStyle = diag(ctx, [m.mid, m.light, m.mid, m.dark, m.mid])
  ctx.lineWidth = width * 0.26
  ctx.stroke(path)
}

function jewel(ctx: Ctx, x: number, y: number, size: number, color: string, edge: string) {
  const g = ctx.createRadialGradient(x - size * 0.35, y - size * 0.35, size * 0.1, x, y, size)
  g.addColorStop(0, '#fff')
  g.addColorStop(0.55, color)
  g.addColorStop(1, edge)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = edge
  ctx.stroke()
}

function studs(ctx: Ctx, pts: Pt[], size: number, color: string, edge: string) {
  for (const [r, a] of pts) {
    const x = C + r * Math.cos(a)
    const y = C + r * Math.sin(a)
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    jewel(ctx, x, y, size, color, edge)
  }
}

function gems(ctx: Ctx, pts: Pt[], size: number, color: string, edge: string) {
  for (const [r, a, i] of pts) {
    const s = i % 2 ? size * 0.6 : size
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const x = C + r * ca
    const y = C + r * sa
    ctx.beginPath()
    ctx.moveTo(x + s * ca, y + s * sa)
    ctx.lineTo(x - s * 0.65 * sa, y + s * 0.65 * ca)
    ctx.lineTo(x - s * ca, y - s * sa)
    ctx.lineTo(x + s * 0.65 * sa, y - s * 0.65 * ca)
    ctx.closePath()
    jewel(ctx, x, y, s, color, edge)
  }
}

function runes(ctx: Ctx, pts: Pt[], len: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 14 * K
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  for (const [r, a, i] of pts) {
    const l = i % 3 === 0 ? len : len * 0.5
    ctx.beginPath()
    ctx.moveTo(C + (r - l) * Math.cos(a), C + (r - l) * Math.sin(a))
    ctx.lineTo(C + (r + l) * Math.cos(a), C + (r + l) * Math.sin(a))
    ctx.stroke()
  }
  ctx.restore()
}

/** Pontas para fora do aro; desenhadas antes dele para a base ficar escondida. */
function spikes(ctx: Ctx, pts: Pt[], len: number, halfW: number, from: string, to: string, edge: string) {
  const g = ctx.createRadialGradient(C, C, pts[0][0] * 0.8, C, C, C)
  g.addColorStop(0, from)
  g.addColorStop(1, to)
  for (const [r, a, i] of pts) {
    const l = i % 2 ? len * 0.6 : len
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    ctx.beginPath()
    ctx.moveTo(C + (r + l) * ca, C + (r + l) * sa)
    ctx.lineTo(C + r * ca - halfW * sa, C + r * sa + halfW * ca)
    ctx.lineTo(C + r * ca + halfW * sa, C + r * sa - halfW * ca)
    ctx.closePath()
    ctx.fillStyle = g
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = edge
    ctx.stroke()
  }
}

interface Def {
  id: string
  name: string
  path: Path2D // contorno da máscara (linha central do aro externo)
  draw?: (ctx: Ctx, path: Path2D) => void
}

const def = (id: string, name: string, shape: PathFn, r: number, draw?: Def['draw']): Def => ({
  id,
  name,
  path: shape(r),
  draw,
})

const CLASSIC: Def[] = [
  def('none', 'Sem moldura', circle, 500),
  def('gold-ring', 'Anel dourado', circle, 462, (c, p) => bevel(c, p, 84, GOLD)),
  def('silver-ring', 'Anel prateado', circle, 462, (c, p) => bevel(c, p, 84, SILVER)),
  def('thin-ring', 'Anel fino', circle, 488, (c, p) => bevel(c, p, 36, IRON)),
  def('double-ring', 'Anel duplo', circle, 474, (c, p) => {
    bevel(c, circle(404), 30, IRON)
    bevel(c, p, 60, GOLD)
  }),
  def('studded', 'Cravejado', circle, 458, (c, p) => {
    bevel(c, p, 96, BRONZE)
    studs(c, ringPoints(458, 12), 20, SILVER.mid, SILVER.edge)
  }),
  def('runic', 'Rúnico', circle, 460, (c, p) => {
    bevel(c, p, 92, IRON)
    runes(c, ringPoints(460, 24), 22, '#8fe9ff')
  }),
  def('hexagon', 'Hexágono', polygon(6), 468, (c, p) => bevel(c, p, 72, BRONZE)),
  def('octagon', 'Octógono', polygon(8, Math.PI / 8), 470, (c, p) => bevel(c, p, 72, SILVER)),
  def('square', 'Quadrado', roundedSquare, 470, (c, p) => bevel(c, p, 72, IRON)),
  def('diamond', 'Losango', polygon(4), 472, (c, p) => bevel(c, p, 64, GOLD)),
  def('shield', 'Escudo', shield, 468, (c, p) => bevel(c, p, 68, SILVER)),
]

// ---- molduras temáticas: cada tema é combinado com cada formato ----

type Deco = 'studs' | 'gems' | 'runes' | 'spikes' | 'rays'

// [id, nome, matiz, saturação, luminosidade, enfeite, cor do enfeite]
const THEMES: [string, string, number, number, number, Deco, string][] = [
  ['fogo', 'Fogo', 14, 85, 48, 'spikes', '#ffb347'],
  ['gelo', 'Gelo', 200, 70, 62, 'spikes', '#e6fbff'],
  ['natureza', 'Natureza', 115, 50, 36, 'gems', '#9be564'],
  ['arcano', 'Arcano', 270, 60, 45, 'runes', '#e39bff'],
  ['necro', 'Necromante', 150, 18, 24, 'runes', '#7dff9a'],
  ['sagrado', 'Sagrado', 46, 75, 66, 'rays', '#fff6c9'],
  ['infernal', 'Infernal', 356, 75, 24, 'spikes', '#ff5a36'],
  ['draco', 'Dracônico', 160, 60, 30, 'studs', '#f2c94c'],
  ['elfico', 'Élfico', 140, 22, 68, 'gems', '#6ee7b7'],
  ['anao', 'Anão', 28, 45, 34, 'studs', '#c8ccd2'],
  ['sangue', 'Sangue', 350, 80, 32, 'gems', '#ff3b4e'],
  ['abissal', 'Abissal', 205, 65, 26, 'studs', '#bff4ff'],
  ['tempestade', 'Tempestade', 220, 35, 45, 'runes', '#ffe95c'],
  ['veneno', 'Veneno', 285, 40, 30, 'gems', '#b6ff3b'],
  ['orc', 'Orc', 18, 55, 28, 'spikes', '#8a8f98'],
  ['real', 'Real', 44, 80, 50, 'gems', '#e0323c'],
  ['lunar', 'Lunar', 225, 30, 70, 'gems', '#dfe9ff'],
  ['solar', 'Solar', 36, 95, 55, 'rays', '#ffd23f'],
  ['druida', 'Druida', 28, 50, 30, 'studs', '#7fbf4d'],
  ['obsidiana', 'Obsidiana', 265, 25, 14, 'runes', '#b88cff'],
  ['osso', 'Osso', 42, 30, 78, 'studs', '#6b5a3e'],
  ['cristal', 'Cristal', 320, 60, 70, 'gems', '#8ff3ff'],
]

// [id, nome, contorno, raio por ângulo, rotação, nº de enfeites, fator de raio]
const SHAPES: [string, string, PathFn, RadFn, number, number, number][] = [
  ['anel', 'Anel', circle, (r) => r, 0, 12, 1],
  ['hex', 'Hexágono', polygon(6), polyRad(6), 0, 12, 1],
  ['oct', 'Octógono', polygon(8, Math.PI / 8), polyRad(8, Math.PI / 8), Math.PI / 8, 16, 1],
  ['quad', 'Quadrado', polygon(4, Math.PI / 4), polyRad(4, Math.PI / 4), Math.PI / 4, 12, 1.3],
  ['los', 'Losango', polygon(4), polyRad(4), 0, 12, 1],
  ['pent', 'Pentágono', polygon(5), polyRad(5), 0, 10, 1],
]

const WIDTH = 76

const THEMED: Def[] = THEMES.flatMap(([tid, tname, h, s, l, deco, accent]) =>
  SHAPES.map(([sid, sname, shape, rad, rot, count, k]) => {
    const m = metal(h, s, l)
    const pointed = deco === 'spikes' || deco === 'rays'
    const r = (pointed ? 395 : 460) * k // pontas precisam de folga até a borda
    return def(`${tid}-${sid}`, `${tname} · ${sname}`, shape, r, (c, p) => {
      const base = (n: number) => points(rad, r, n, rot).map(([pr, a, i]): Pt => [pr + WIDTH / 2 - 8, a, i])
      if (deco === 'spikes') spikes(c, base(count), 66, 26, m.mid, accent, m.edge)
      if (deco === 'rays') spikes(c, base(count * 2), 70, 11, accent, '#fff', m.dark)
      bevel(c, p, WIDTH, m)
      const on = points(rad, r, count, rot)
      if (deco === 'studs') studs(c, on, 17, accent, m.edge)
      if (deco === 'gems') gems(c, on, 26, accent, m.edge)
      if (deco === 'runes') runes(c, points(rad, r, count * 2, rot), 20, accent)
    })
  }),
)

function render(size: number, paint: (ctx: Ctx) => void) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  K = size / R
  ctx.scale(K, K)
  paint(ctx)
  K = 1
  return c
}

export interface BuiltinFrame {
  id: string
  name: string
  /** Miniatura já no tamanho final; null quando não há aro. */
  thumb(size: number): string | null
  /** Gera aro e máscara em tamanho real; chamado só para a moldura em uso. */
  build(): { ring: HTMLCanvasElement | null; mask: HTMLCanvasElement }
}

export const BUILTIN: BuiltinFrame[] = [...CLASSIC, ...THEMED].map((d) => ({
  id: d.id,
  name: d.name,
  thumb: (size) => (d.draw ? render(size, (c) => d.draw!(c, d.path)).toDataURL() : null),
  build: () => ({
    ring: d.draw ? render(R, (c) => d.draw!(c, d.path)) : null,
    mask: render(R, (c) => {
      c.fillStyle = '#fff'
      c.fill(d.path)
    }),
  }),
}))
