// Ayudas para ejecutar comandos desde las pantallas y mostrar su resultado.
import { useState } from 'react'
import { useAccion } from './store.js'
import { ACTORES, actorProductor, CAMPOS_CORREGIBLES } from './domain/constants.js'
import { Aviso } from './ui.jsx'

export function actorDe(state, perfil) {
  if (!perfil) return null
  if (perfil.rol === 'productor') {
    const b = state.entities.bodegas.find((x) => x.id === perfil.bodegaId)
    return b ? actorProductor(b) : null
  }
  return ACTORES[perfil.rol]?.find((a) => a.id === perfil.actorId) ?? null
}

// Ejecuta un comando con id estable y deja el resultado listo para mostrar.
export function useOperacion() {
  const accion = useAccion()
  const [res, setRes] = useState(null)
  function run(cmd, okMsg) {
    const r = accion(cmd)
    if (r.ok) {
      const t = typeof okMsg === 'function' ? okMsg(r.respuesta) : okMsg
      setRes(t ? { tono: 'ok', t: r.duplicado ? `${t} (ya estaba aplicado: no se repitió)` : t } : null)
    } else {
      setRes({ tono: 'error', t: r.error.message, code: r.error.code, detalle: r.error.detalle })
    }
    return r
  }
  return [run, res, setRes]
}

export function Resultado({ res, onActualizar }) {
  if (!res) return null
  const errores = res.detalle?.errores
  const pend = res.detalle?.pendientes
  return (
    <Aviso
      tono={res.tono}
      titulo={res.t}
      accion={res.code === 'REVISION_DESACTUALIZADA' && onActualizar ? <button className="btn btn-secundario" onClick={onActualizar}>Traer los datos nuevos</button> : null}
    >
      {errores?.length > 0 && <ul className="mt-1 list-disc pl-5">{errores.map((e) => <li key={e.campo + e.mensaje}>{e.mensaje}</li>)}</ul>}
      {pend?.length > 0 && <ul className="mt-1 list-disc pl-5">{pend.map((p) => <li key={p.id}>{p.texto}: {p.detalle}</li>)}</ul>}
      {res.code === 'GUARDADO' && <p>Usamos el mismo número de operación al reintentar, así no se aplica dos veces.</p>}
    </Aviso>
  )
}

export function etiquetaCampo(post, ruta) {
  const [grupo, campo, etiquetaId] = ruta.split('.')
  const base = CAMPOS_CORREGIBLES[`${grupo}.${campo}`] ?? ruta
  if (grupo === 'etiqueta') {
    const e = post?.etiquetas.find((x) => x.id === etiquetaId)
    return `${base} · ${e?.nombre || etiquetaId}`
  }
  return base
}

export const valorTexto = (v) => (v === null || v === undefined || v === '' ? '—' : String(v))
