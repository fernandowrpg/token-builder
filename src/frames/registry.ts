import { releaseTexture } from '../render/adjust'
import { adjustedImage, canvasBlob, decodeImage, makeCanvas, makeThumb, type Adjustable } from '../resources'
import { db } from '../storage/db'
import type { Adjust, MaskMode } from '../types'
import { BUILTIN, FRAME_SIZE, type BuiltinFrame } from './builtin'
import { buildMask } from './mask'

export interface FrameEntry extends Adjustable {
  id: string
  name: string
  builtin: boolean
  ring: HTMLCanvasElement | null
  mask: HTMLCanvasElement
  thumb: string
  maskMode: MaskMode
}

interface StoredFrame {
  id: string
  name: string
  blob: Blob
  maskMode: MaskMode
}

/** O que a galeria precisa para listar uma moldura, sem os bitmaps. */
export type FrameInfo = Pick<FrameEntry, 'id' | 'name' | 'builtin' | 'thumb'>

const FALLBACK = 'gold-ring'
const frames = new Map<string, FrameEntry>()
const builtin = new Map<string, BuiltinFrame>()
const builtinInfo: FrameInfo[] = []
let liveBuiltin: string | undefined

function emptyThumb() {
  const c = makeCanvas(96, 96)
  const ctx = c.getContext('2d')!
  ctx.setLineDash([6, 6])
  ctx.strokeStyle = '#8891a5'
  ctx.lineWidth = 2
  ctx.arc(48, 48, 40, 0, Math.PI * 2)
  ctx.stroke()
  return c.toDataURL()
}

export function initBuiltinFrames() {
  const empty = emptyThumb()
  for (const b of BUILTIN) {
    builtin.set(b.id, b)
    builtinInfo.push({ id: b.id, name: b.name, builtin: true, thumb: b.thumb(96) ?? empty })
  }
}

export const listFrames = (): FrameInfo[] => [...builtinInfo, ...frames.values()].filter(
  (f, i) => i < builtinInfo.length || !f.builtin,
)

export function getFrame(id: string): FrameEntry {
  const key = frames.has(id) || builtin.has(id) ? id : FALLBACK
  const hit = frames.get(key)
  if (hit) return hit
  // molduras padrão são geradas sob demanda; só a que está em uso fica na memória
  const old = liveBuiltin && frames.get(liveBuiltin)
  if (old) {
    if (old.ring) releaseTexture(old.ring)
    frames.delete(old.id)
  }
  const b = builtin.get(key)!
  const entry: FrameEntry = { id: b.id, name: b.name, builtin: true, maskMode: 'auto', thumb: '', ...b.build() }
  frames.set(key, entry)
  liveBuiltin = key
  return entry
}

export function frameRing(entry: FrameEntry, adjust: Adjust) {
  return entry.ring ? adjustedImage(entry.ring, adjust, entry) : null
}

async function install(rec: StoredFrame) {
  const img = await decodeImage(rec.blob, FRAME_SIZE)
  // encaixa a imagem em um quadrado para a moldura girar e escalar pelo centro
  const ring = makeCanvas(FRAME_SIZE, FRAME_SIZE)
  const k = Math.min(FRAME_SIZE / img.width, FRAME_SIZE / img.height)
  const w = img.width * k
  const h = img.height * k
  const ctx = ring.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (FRAME_SIZE - w) / 2, (FRAME_SIZE - h) / 2, w, h)
  frames.set(rec.id, {
    id: rec.id,
    name: rec.name,
    builtin: false,
    ring,
    mask: buildMask(ring, rec.maskMode),
    maskMode: rec.maskMode,
    thumb: makeThumb(ring, FRAME_SIZE, FRAME_SIZE, 96),
  })
}

export async function loadCustomFrames() {
  for (const rec of await db.all<StoredFrame>('frames')) {
    try {
      await install(rec)
    } catch (err) {
      console.warn(`Moldura "${rec.name}" não pôde ser carregada`, err)
    }
  }
}

export async function registerFrame(name: string, blob: Blob, maskMode: MaskMode) {
  const rec: StoredFrame = { id: crypto.randomUUID(), name, blob, maskMode }
  await install(rec)
  await db.put('frames', rec)
  return rec.id
}

export async function removeFrame(id: string) {
  const entry = frames.get(id)
  if (!entry || entry.builtin) return
  if (entry.ring) releaseTexture(entry.ring)
  frames.delete(id)
  await db.del('frames', id)
}

/** Grava a moldura com os ajustes de cor atuais como uma nova entrada da galeria. */
export async function saveVariant(entry: FrameEntry, adjust: Adjust, name: string) {
  const ring = frameRing(entry, adjust)
  if (!ring) return null
  return registerFrame(name, await canvasBlob(ring), entry.builtin ? 'auto' : entry.maskMode)
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result as string)
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(blob)
  })

export async function exportLibrary(): Promise<Blob> {
  const stored = await db.all<StoredFrame>('frames')
  const list = await Promise.all(
    stored.map(async (f) => ({ name: f.name, maskMode: f.maskMode, image: await toDataUrl(f.blob) })),
  )
  return new Blob([JSON.stringify({ version: 1, frames: list })], { type: 'application/json' })
}

export async function importLibrary(file: Blob): Promise<number> {
  const data = JSON.parse(await file.text())
  if (!Array.isArray(data?.frames)) throw new Error('Arquivo de biblioteca inválido')
  let count = 0
  for (const f of data.frames) {
    if (typeof f?.name !== 'string' || typeof f?.image !== 'string' || !f.image.startsWith('data:image/')) continue
    const mode: MaskMode = f.maskMode === 'circle' || f.maskMode === 'square' ? f.maskMode : 'auto'
    await registerFrame(f.name, await (await fetch(f.image)).blob(), mode)
    count++
  }
  return count
}
