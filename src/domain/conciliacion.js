// Conciliación: reconstruye los totales desde la apertura + eventos y los compara
// con lo que dicen los registros. Las diferencias se muestran, nunca se tapan con cero.
import { ESTADOS } from './constants.js'
import { totalesDeRegistros } from './engine.js'

export function totalesDesdeEventos(state, convId) {
  const apertura = state.entities.aperturas.find((a) => a.convocatoriaId === convId)
  const base = apertura?.totales ?? { postulaciones: 0, porEstado: {}, cupo: 0, mesasAsignadas: 0, mesasEntregadas: 0, listaEspera: 0 }
  const t = {
    postulaciones: base.postulaciones,
    porEstado: { ...base.porEstado },
    cupo: base.cupo,
    mesasAsignadas: base.mesasAsignadas,
    mesasEntregadas: base.mesasEntregadas,
    listaEspera: base.listaEspera,
  }
  const desde = apertura?.revision ?? 0
  for (const ev of state.eventos) {
    if (ev.convocatoriaId !== convId || ev.revision <= desde) continue
    if (ev.entidad === 'postulacion' && ev.estadoAnterior !== ev.estadoNuevo && ev.estadoNuevo) {
      if (ev.estadoAnterior) t.porEstado[ev.estadoAnterior] = (t.porEstado[ev.estadoAnterior] ?? 0) - 1
      else t.postulaciones += 1
      t.porEstado[ev.estadoNuevo] = (t.porEstado[ev.estadoNuevo] ?? 0) + 1
    }
    for (const ef of ev.efectos ?? []) {
      if (ef.tipo === 'mesa_asignada') t.mesasAsignadas += 1
      if (ef.tipo === 'mesa_liberada') t.mesasAsignadas -= 1
      if (ef.tipo === 'mesa_entregada') t.mesasEntregadas += 1
      if (ef.tipo === 'cupo_cambiado') t.cupo = ef.a
    }
  }
  t.listaEspera = t.porEstado.lista_espera ?? 0
  for (const k of Object.keys(t.porEstado)) if (t.porEstado[k] === 0) delete t.porEstado[k]
  return { totales: t, apertura }
}

// Filas comparables: cada una con valor por eventos, por registros y diferencia.
export function conciliar(state, convId) {
  const { totales: ev, apertura } = totalesDesdeEventos(state, convId)
  const reg = totalesDeRegistros(state, convId)
  const filas = [
    { clave: 'postulaciones', label: 'Postulaciones', eventos: ev.postulaciones, registros: reg.postulaciones },
    ...ESTADOS.map((e) => ({ clave: `estado.${e.id}`, label: e.label, estado: e.id, eventos: ev.porEstado[e.id] ?? 0, registros: reg.porEstado[e.id] ?? 0 })),
    { clave: 'cupo', label: 'Cupo de mesas', eventos: ev.cupo, registros: reg.cupo },
    { clave: 'mesasAsignadas', label: 'Mesas asignadas (reservadas)', eventos: ev.mesasAsignadas, registros: reg.mesasAsignadas },
    { clave: 'mesasEntregadas', label: 'Mesas acreditadas (entregadas el día de la feria)', eventos: ev.mesasEntregadas, registros: reg.mesasEntregadas },
    { clave: 'listaEspera', label: 'Lista de espera', eventos: ev.listaEspera, registros: reg.listaEspera },
  ].map((f) => ({ ...f, diferencia: f.registros - f.eventos }))
  return { filas, apertura, cuadra: filas.every((f) => f.diferencia === 0), registros: reg }
}

// Evidencias de que repetir operaciones no duplica efectos.
export function evidencias(state, convId) {
  const evs = state.eventos.filter((e) => e.convocatoriaId === convId)
  const porPost = new Map()
  for (const e of evs) {
    for (const ef of e.efectos ?? []) {
      if (!['mesa_asignada', 'mesa_liberada', 'mesa_entregada'].includes(ef.tipo)) continue
      const m = porPost.get(e.entidadId) ?? { mesa_asignada: 0, mesa_liberada: 0, mesa_entregada: 0 }
      m[ef.tipo] += 1
      porPost.set(e.entidadId, m)
    }
  }
  const liberacionesDeMas = [...porPost.entries()].filter(([, m]) => m.mesa_liberada > m.mesa_asignada + 1)
  const entregasRepetidas = [...porPost.entries()].filter(([, m]) => m.mesa_entregada > 1)
  const cierres = state.entities.cierres.filter((c) => c.convocatoriaId === convId)
  const mesasRepetidas = (() => {
    const vistas = new Set()
    const rep = []
    for (const p of state.entities.postulaciones) {
      if (p.convocatoriaId !== convId || p.mesa == null) continue
      if (vistas.has(p.mesa)) rep.push(p.mesa)
      vistas.add(p.mesa)
    }
    return rep
  })()
  const idsComando = state.comandos.map((c) => c.id)
  return [
    { label: 'Cierres registrados para esta edición', valor: cierres.length, ok: cierres.length <= 1, esperado: 'como máximo 1' },
    { label: 'Mesas asignadas a dos bodegas', valor: mesasRepetidas.length, ok: mesasRepetidas.length === 0, esperado: '0' },
    { label: 'Bodegas con más liberaciones que asignaciones', valor: liberacionesDeMas.length, ok: liberacionesDeMas.length === 0, esperado: '0' },
    { label: 'Mesas acreditadas más de una vez', valor: entregasRepetidas.length, ok: entregasRepetidas.length === 0, esperado: '0' },
    { label: 'Ids de comando repetidos en el registro', valor: idsComando.length - new Set(idsComando).size, ok: idsComando.length === new Set(idsComando).size, esperado: '0' },
  ]
}

export function aCSV(filas, columnas) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columnas.map((c) => esc(c.label)).join(','), ...filas.map((f) => columnas.map((c) => esc(c.valor(f))).join(','))].join('\n')
}
