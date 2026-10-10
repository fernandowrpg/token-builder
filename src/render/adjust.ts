import type { Adjust } from '../types'

// Ajuste de cor por camada feito em um único passe de shader, em vez de
// ctx.filter: funciona igual em todos os navegadores e permite "colorir".

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uHue, uSat, uBright, uContrast, uTintAmount;
uniform vec2 uTint; // matiz e saturação da cor de tingimento

vec3 rgb2hsl(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float l = (mx + mn) * 0.5;
  float d = mx - mn;
  float h = 0.0;
  float s = 0.0;
  if (d > 0.00001) {
    s = clamp(d / (1.0 - abs(2.0 * l - 1.0)), 0.0, 1.0);
    if (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

vec3 hsl2rgb(vec3 hsl) {
  vec3 k = mod(vec3(0.0, 8.0, 4.0) + hsl.x * 12.0, 12.0);
  float a = hsl.y * min(hsl.z, 1.0 - hsl.z);
  return hsl.z - a * max(min(min(k - 3.0, 9.0 - k), 1.0), -1.0);
}

void main() {
  vec4 t = texture2D(uTex, vUv);
  vec3 hsl = rgb2hsl(t.rgb);
  hsl.x = fract(hsl.x + uHue);
  hsl.y = clamp(hsl.y * uSat, 0.0, 1.0);
  vec3 c = hsl2rgb(hsl);
  c = mix(c, hsl2rgb(vec3(uTint.x, uTint.y, hsl.z)), uTintAmount);
  c = (c * uBright - 0.5) * uContrast + 0.5;
  c = clamp(c, 0.0, 1.0);
  gl_FragColor = vec4(c * t.a, t.a);
}`

interface Gl {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  uniforms: Record<string, WebGLUniformLocation | null>
  textures: WeakMap<HTMLCanvasElement, WebGLTexture>
}

let ctx: Gl | null | undefined

function init(): Gl | null {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false })
  if (!gl) return null
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    return sh
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Shader de ajuste de cor falhou:', gl.getProgramInfoLog(prog))
    return null
  }
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  const uniforms: Gl['uniforms'] = {}
  for (const name of ['uHue', 'uSat', 'uBright', 'uContrast', 'uTintAmount', 'uTint'])
    uniforms[name] = gl.getUniformLocation(prog, name)
  // contexto perdido: recria tudo na próxima chamada
  canvas.addEventListener('webglcontextlost', () => (ctx = undefined))
  return { canvas, gl, uniforms, textures: new WeakMap() }
}

function hueSat(hex: string): [number, number] {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const d = mx - mn
  if (d === 0) return [0, 0]
  const l = (mx + mn) / 2
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h / 6 + 1) % 1
  return [h, Math.min(1, s)]
}

/** Libera a textura associada a uma imagem que não será mais usada. */
export function releaseTexture(source: HTMLCanvasElement) {
  const tex = ctx?.textures.get(source)
  if (tex) {
    ctx!.gl.deleteTexture(tex)
    ctx!.textures.delete(source)
  }
}

/**
 * Aplica os ajustes em `source` e grava o resultado em `target` (criado se
 * ausente). Devolve null quando WebGL não está disponível.
 */
export function applyAdjust(
  source: HTMLCanvasElement,
  a: Adjust,
  target?: HTMLCanvasElement,
): HTMLCanvasElement | null {
  if (ctx === undefined) ctx = init()
  if (!ctx || ctx.gl.isContextLost()) return null
  const { gl, canvas, uniforms, textures } = ctx
  const w = source.width
  const h = source.height
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  gl.viewport(0, 0, w, h)

  let tex = textures.get(source)
  if (tex) {
    gl.bindTexture(gl.TEXTURE_2D, tex)
  } else {
    tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    textures.set(source, tex)
  }

  gl.uniform1f(uniforms.uHue, a.hue / 360)
  gl.uniform1f(uniforms.uSat, a.saturation)
  gl.uniform1f(uniforms.uBright, a.brightness)
  gl.uniform1f(uniforms.uContrast, a.contrast)
  gl.uniform1f(uniforms.uTintAmount, a.tintAmount)
  gl.uniform2fv(uniforms.uTint, hueSat(a.tint))
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  const out = target ?? document.createElement('canvas')
  if (out.width !== w || out.height !== h) {
    out.width = w
    out.height = h
  }
  const c2d = out.getContext('2d')!
  c2d.clearRect(0, 0, w, h)
  c2d.drawImage(canvas, 0, 0)
  return out
}
