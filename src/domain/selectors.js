// Cálculos derivados. Nunca se guardan: siempre salen de los registros de origen.
import { E } from './constants.js'

export const convocatoria = (state, id) => state.entities.convocatorias.find((c) => c.id === id)
export const postulacion = (state, id) => state.entities.postulaciones.find((p) => p.id === id)
export const bodega = (state, id) => state.entities.bodegas.find((b) => b.id === id)
export const postulacionesDe = (state, convId) => state.entities.postulaciones.filter((p) => p.convocatoriaId === convId)

export const requisito = (conv, clave) => conv.requisitos.find((r) => r.clave === clave)
export function maxEtiquetas(conv) {
  return requisito(conv, 'etiquetas')?.param?.max ?? 6
}
export function minEtiquetas(conv) {
  return requisito(conv, 'etiquetas')?.param?.min ?? 1
}

// Evalúa el checklist de una postulación contra los requisitos vigentes de su convocatoria.
// Automáticos: sulfitos, cantidad de etiquetas, botellas. Manuales: los tilda la organización.
export function evaluarRequisitos(post, conv) {
  return conv.requisitos.map((req) => {
    let cumple
    let detalle = ''
    if (req.clave === 'sulfitos') {
      const max = req.param.max
      const sinDato = post.etiquetas.filter((e) => !esNumero(e.sulfitos))
      const altos = post.etiquetas.filter((e) => esNumero(e.sulfitos) && Number(e.sulfitos) > max)
      cumple = post.etiquetas.length > 0 && altos.length === 0 && sinDato.length === 0
      if (altos.length) detalle = altos.map((e) => `${e.nombre || 'Sin nombre'}: ${e.sulfitos} mg/l (tope ${max})`).join(' · ')
      else if (sinDato.length) detalle = `Falta el dato de sulfitos en ${sinDato.length} etiqueta(s)`
      else if (!post.etiquetas.length) detalle = 'No hay etiquetas cargadas'
      else detalle = `Todas por debajo de ${max} mg/l`
    } else if (req.clave === 'etiquetas') {
      const n = post.etiquetas.length
      cumple = n >= req.param.min && n <= req.param.max
      detalle = `${n} etiqueta(s), se permiten entre ${req.param.min} y ${req.param.max}`
    } else if (req.clave === 'botellas') {
      const b = post.ficha.botellasAnio
      cumple = esNumero(b) && Number(b) <= req.param.max
      detalle = esNumero(b) ? `${Number(b).toLocaleString('es-AR')} botellas/año (tope ${req.param.max.toLocaleString('es-AR')})` : 'Falta el dato de botellas por año'
    } else {
      // La marca vale solo si se hizo contra la versión vigente del requisito.
      // Una marca vieja no se borra: queda como antecedente, pero no cuenta.
      const m = post.checklistManual?.[req.id]
      cumple = m?.valor === true && m.version >= req.version
      if (cumple) detalle = 'Verificado por la organización'
      else if (m?.valor === true) detalle = `Verificado con la versión ${m.version}; el requisito cambió en la versión ${req.version}`
      else detalle = 'Pendiente de verificar'
    }
    return { req, cumple, detalle, automatico: req.tipo === 'auto' }
  })
}
export const pendientes = (post, conv) => evaluarRequisitos(post, conv).filter((r) => !r.cumple)

function esNumero(v) {
  return v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))
}

// Mesas de una convocatoria derivadas de las postulaciones aprobadas.
export function mesas(state, convId) {
  const conv = convocatoria(state, convId)
  const posts = postulacionesDe(state, convId)
  const asignadas = posts.filter((p) => p.mesa != null).sort((a, b) => a.mesa - b.mesa)
  const ocupadas = new Set(asignadas.map((p) => p.mesa))
  const libres = []
  for (let n = 1; n <= conv.cupo; n++) if (!ocupadas.has(n)) libres.push(n)
  const espera = posts.filter((p) => p.estado === E.LISTA_ESPERA).sort((a, b) => a.ordenEspera - b.ordenEspera)
  const entregadas = asignadas.filter((p) => p.mesaEntregada)
  return { cupo: conv.cupo, asignadas, libres, espera, entregadas, mayorAsignada: asignadas.length ? asignadas[asignadas.length - 1].mesa : 0 }
}

export function posicionEspera(state, post) {
  if (post.estado !== E.LISTA_ESPERA) return null
  return mesas(state, post.convocatoriaId).espera.findIndex((p) => p.id === post.id) + 1
}

export const historial = (state, postId) =>
  state.eventos.filter((ev) => ev.entidadId === postId || ev.relacionadas?.includes(postId))

export const propuestasDe = (state, postId) => state.entities.propuestas.filter((p) => p.postulacionId === postId)

// Una propuesta está desactualizada si el registro cambió desde que se creó.
export function propuestaDesactualizada(state, prop) {
  const post = postulacion(state, prop.postulacionId)
  return prop.estado === 'pendiente' && post && post.rev !== prop.revisionPartida
}

export function valorCampo(post, ruta) {
  const [grupo, campo, etiquetaId] = ruta.split('.')
  if (grupo === 'ficha') return post.ficha[campo]
  if (grupo === 'etiqueta') return post.etiquetas.find((e) => e.id === etiquetaId)?.[campo]
  return undefined
}
