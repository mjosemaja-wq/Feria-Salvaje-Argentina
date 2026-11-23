// Puente entre el repositorio de dominio y React.
import { useSyncExternalStore, useRef, useCallback } from 'react'
import { crearAdaptador, crearRepositorio } from './domain/repositorio.js'
import { PERFIL_KEY, STORAGE_KEY } from './domain/constants.js'
import { huella, nuevoId } from './domain/util.js'

export const adaptador = crearAdaptador(window.localStorage, STORAGE_KEY)
export const repo = crearRepositorio(adaptador)
const arranque = repo.iniciar()

const oyentes = new Set()
let version = 0
const avisar = () => {
  version += 1
  oyentes.forEach((f) => f())
}
const suscribir = (f) => {
  oyentes.add(f)
  return () => oyentes.delete(f)
}

// Otra pestaña guardó: adoptamos su copia. Los formularios abiertos conservan
// su revisión de partida, así que un envío viejo da conflicto en vez de pisar.
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY && e.newValue) {
    repo.recargarDesdeAlmacen()
    avisar()
  }
  if (e.key === PERFIL_KEY) avisar()
})

export const estadoArranque = arranque
export function useDominio() {
  useSyncExternalStore(suscribir, () => version)
  return repo.state
}
export function useErrorAlmacen() {
  useSyncExternalStore(suscribir, () => version)
  return repo.error
}

export function despachar(cmd) {
  const r = repo.despachar(cmd)
  if (r.ok && !r.duplicado) avisar()
  return r
}
export function importar(texto) {
  const r = repo.importar(texto)
  if (r.ok) avisar()
  return r
}
export function restaurarSemilla() {
  const r = repo.restaurarSemilla()
  if (r.ok) avisar()
  return r
}

// ───── perfil local (no es autenticación) ─────
export function leerPerfil() {
  try {
    return JSON.parse(window.localStorage.getItem(PERFIL_KEY) || 'null')
  } catch {
    return null
  }
}
export function guardarPerfil(perfil) {
  try {
    if (perfil) window.localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil))
    else window.localStorage.removeItem(PERFIL_KEY)
  } catch {
    /* el perfil queda solo en memoria */
  }
  perfilMemoria = perfil
  avisar()
}
let perfilMemoria = leerPerfil()
export function usePerfil() {
  useSyncExternalStore(suscribir, () => version)
  return perfilMemoria
}

/**
 * Acción con id de operación estable: si el guardado falla, el reintento usa el
 * mismo id (el motor lo aplica una sola vez). Si cambian los datos después de un
 * éxito, se genera un id nuevo.
 */
export function useAccion() {
  const ref = useRef({ id: null, firma: null })
  return useCallback((cmd) => {
    const firma = huella({ tipo: cmd.tipo, datos: cmd.datos, revisionEsperada: cmd.revisionEsperada ?? null })
    if (!ref.current.id || ref.current.firma !== firma) ref.current = { id: nuevoId('cmd'), firma }
    const r = despachar({ ...cmd, id: ref.current.id })
    if (!r.ok && r.error.code !== 'GUARDADO') ref.current = { id: null, firma: null }
    return r
  }, [])
}
