// Validación y migración de copias guardadas. Todo o nada: una copia inválida
// se rechaza entera y el estado anterior queda intacto.
import { SCHEMA_VERSION, ESTADO_POR_ID } from './constants.js'
import { clone } from './util.js'

const COLECCIONES = ['convocatorias', 'bodegas', 'postulaciones', 'propuestas', 'ajustes', 'cierres', 'aperturas']
const OBLIGATORIAS_V1 = ['convocatorias', 'bodegas', 'postulaciones']

export function validarSnapshot(s) {
  const errores = []
  const e = (m) => errores.push(m)
  if (!s || typeof s !== 'object') return { ok: false, errores: ['La copia no es un objeto JSON.'] }
  if (s.schemaVersion !== SCHEMA_VERSION) e(`schemaVersion ${s.schemaVersion} no es la esperada (${SCHEMA_VERSION}).`)
  if (!Number.isInteger(s.revision) || s.revision < 0) e('Falta revision o no es un entero.')
  if (!s.entities || typeof s.entities !== 'object') return { ok: false, errores: [...errores, 'Faltan las entidades.'] }
  for (const c of COLECCIONES) if (!Array.isArray(s.entities[c])) e(`Falta la colección ${c}.`)
  if (!Array.isArray(s.eventos)) e('Faltan los eventos.')
  if (!Array.isArray(s.comandos)) e('Faltan los comandos.')
  if (errores.length) return { ok: false, errores }

  const ids = {}
  for (const c of COLECCIONES) {
    ids[c] = new Set()
    for (const x of s.entities[c]) {
      if (!x || typeof x.id !== 'string') { e(`Registro sin id en ${c}.`); continue }
      if (ids[c].has(x.id)) e(`Id duplicado en ${c}: ${x.id}.`)
      ids[c].add(x.id)
    }
  }
  const idsEv = new Set()
  for (const ev of s.eventos) {
    if (idsEv.has(ev.id)) e(`Id de evento duplicado: ${ev.id}.`)
    idsEv.add(ev.id)
  }
  const idsCmd = new Set()
  for (const c of s.comandos) {
    if (idsCmd.has(c.id)) e(`Id de comando duplicado: ${c.id}.`)
    idsCmd.add(c.id)
    for (const evId of c.eventos ?? []) if (!idsEv.has(evId)) e(`El comando ${c.id} apunta a un evento inexistente (${evId}).`)
  }
  for (const ev of s.eventos) if (ev.comandoId && !idsCmd.has(ev.comandoId)) e(`El evento ${ev.id} apunta a un comando inexistente.`)

  const convs = new Map(s.entities.convocatorias.map((c) => [c.id, c]))
  for (const c of s.entities.convocatorias) {
    if (!Number.isInteger(c.cupo) || c.cupo < 0) e(`Cupo inválido en ${c.id}.`)
    if (!Array.isArray(c.requisitos)) e(`La convocatoria ${c.id} no tiene requisitos.`)
    if (c.cierreId && !ids.cierres.has(c.cierreId)) e(`La convocatoria ${c.id} apunta a un cierre inexistente.`)
  }
  const mesasUsadas = new Set()
  for (const p of s.entities.postulaciones) {
    if (!convs.has(p.convocatoriaId)) e(`La postulación ${p.id} apunta a una convocatoria inexistente (${p.convocatoriaId}).`)
    if (!ids.bodegas.has(p.bodegaId)) e(`La postulación ${p.id} apunta a una bodega inexistente (${p.bodegaId}).`)
    if (!ESTADO_POR_ID[p.estado]) e(`Estado desconocido en ${p.id}: ${p.estado}.`)
    if (!Array.isArray(p.etiquetas)) e(`La postulación ${p.id} no tiene lista de etiquetas.`)
    if (p.mesa != null) {
      const k = `${p.convocatoriaId}#${p.mesa}`
      if (mesasUsadas.has(k)) e(`Mesa ${p.mesa} asignada dos veces en ${p.convocatoriaId}.`)
      mesasUsadas.add(k)
      const conv = convs.get(p.convocatoriaId)
      if (conv && p.mesa > conv.cupo) e(`La mesa ${p.mesa} de ${p.id} supera el cupo.`)
    }
  }
  for (const pr of s.entities.propuestas) if (!ids.postulaciones.has(pr.postulacionId)) e(`La propuesta ${pr.id} apunta a una postulación inexistente.`)
  for (const a of s.entities.ajustes) {
    if (!ids.propuestas.has(a.propuestaId)) e(`El ajuste ${a.id} apunta a una propuesta inexistente.`)
    if (!ids.postulaciones.has(a.postulacionId)) e(`El ajuste ${a.id} apunta a una postulación inexistente.`)
  }
  for (const c of s.entities.cierres) if (!convs.has(c.convocatoriaId)) e(`El cierre ${c.id} apunta a una convocatoria inexistente.`)
  for (const a of s.entities.aperturas) if (!convs.has(a.convocatoriaId)) e(`La apertura ${a.id} apunta a una convocatoria inexistente.`)
  return { ok: errores.length === 0, errores }
}

export function migrarV1aV2(v1) {
  if (!v1 || v1.schemaVersion !== 1 || !v1.entities) return { ok: false, errores: ['No es una copia v1.'] }
  for (const c of OBLIGATORIAS_V1) if (!Array.isArray(v1.entities[c])) return { ok: false, errores: [`La copia v1 no trae ${c}.`] }
  const entities = clone(v1.entities)
  for (const c of COLECCIONES) if (entities[c] === undefined) entities[c] = []
  const v2 = { schemaVersion: 2, revision: 1, entities, eventos: [], comandos: [] }
  const val = validarSnapshot(v2)
  return val.ok ? { ok: true, state: v2 } : { ok: false, errores: val.errores }
}

// Lee un texto guardado o importado. Nunca devuelve una restauración parcial.
export function leerCopia(texto) {
  let datos
  try {
    datos = JSON.parse(texto)
  } catch {
    return { ok: false, errores: ['La copia está truncada o no es JSON válido.'] }
  }
  if (datos?.schemaVersion === 1) {
    const m = migrarV1aV2(datos)
    return m.ok ? { ok: true, state: m.state, migrada: true } : m
  }
  if (datos?.schemaVersion === 2) {
    const v = validarSnapshot(datos)
    return v.ok ? { ok: true, state: datos } : { ok: false, errores: v.errores }
  }
  return { ok: false, errores: [`Formato desconocido (schemaVersion: ${datos?.schemaVersion ?? 'sin dato'}).`] }
}
