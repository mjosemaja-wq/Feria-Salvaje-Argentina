import { ZONA_HORARIA } from './constants.js'

export class DomainError extends Error {
  constructor(code, message, detalle = null) {
    super(message)
    this.code = code
    this.detalle = detalle
  }
}

export const clone = (x) => JSON.parse(JSON.stringify(x))

// JSON con claves ordenadas: el mismo contenido da siempre el mismo texto.
export function stableStringify(v) {
  if (v === undefined) return 'null'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  return `{${Object.keys(v)
    .filter((k) => v[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
    .join(',')}}`
}

// Huella corta (FNV-1a) para comparar comandos con el mismo id.
export function huella(v) {
  const s = stableStringify(v)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// Fecha calendario (AAAA-MM-DD) de un instante en la zona configurada.
export function fechaLocal(instante, zona = ZONA_HORARIA) {
  const d = new Date(instante)
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// Límites inclusivos: el día de apertura y el día de cierre cuentan.
export function dentroDePlazo(conv, instante) {
  const hoy = fechaLocal(instante, conv.zonaHoraria || ZONA_HORARIA)
  if (hoy < conv.apertura) return { ok: false, motivo: 'todavia_no_abre', hoy }
  if (hoy > conv.cierre) return { ok: false, motivo: 'cerro', hoy }
  return { ok: true, hoy }
}

export const formatoPesos = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export const formatoNumero = (n) => new Intl.NumberFormat('es-AR').format(n)

export function formatoFecha(iso, zona = ZONA_HORARIA) {
  if (!iso) return '—'
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00-03:00`) : new Date(iso)
  return new Intl.DateTimeFormat('es-AR', { timeZone: zona, day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

export function formatoInstante(iso, zona = ZONA_HORARIA) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: zona, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

// Porcentaje que no inventa ceros: sin denominador devuelve null ("Sin datos").
export const ratio = (num, den) => (den > 0 ? num / den : null)
export const formatoPct = (r) => (r === null || r === undefined ? 'Sin datos' : `${Math.round(r * 100)}%`)

let contador = 0
export function nuevoId(prefijo) {
  contador = (contador + 1) % 1e6
  const rnd = Math.random().toString(36).slice(2, 8)
  return `${prefijo}-${Date.now().toString(36)}${contador.toString(36)}${rnd}`
}
