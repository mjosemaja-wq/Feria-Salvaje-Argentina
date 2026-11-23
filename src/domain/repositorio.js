// Persistencia: un adaptador sobre localStorage y un repositorio que guarda
// primero y recién después confirma. Si setItem falla, el estado anterior queda.
import { STORAGE_KEY } from './constants.js'
import { ejecutar } from './engine.js'
import { leerCopia } from './migracion.js'
import { crearSemilla } from './seed.js'

export function crearAdaptador(storage, key = STORAGE_KEY) {
  let fallosPendientes = 0
  return {
    key,
    leer: () => storage.getItem(key),
    escribir(state) {
      if (fallosPendientes > 0) {
        fallosPendientes -= 1
        throw new Error('Fallo simulado del adaptador de guardado')
      }
      storage.setItem(key, JSON.stringify(state))
    },
    simularFallo(n = 1) {
      fallosPendientes = n
    },
    get fallosPendientes() {
      return fallosPendientes
    },
  }
}

export const ERROR_GUARDADO = {
  code: 'GUARDADO',
  message: 'No pudimos guardar en este navegador. No se cambió nada y lo que escribiste sigue acá: probá de nuevo.',
}

export function crearRepositorio(adaptador, { reloj = () => Date.now() } = {}) {
  let state = null
  let error = null

  const repo = {
    get state() {
      return state
    },
    get error() {
      return error
    },
    iniciar() {
      let raw
      try {
        raw = adaptador.leer()
      } catch {
        raw = null
      }
      if (raw === null || raw === undefined) {
        const semilla = crearSemilla()
        state = semilla
        try {
          adaptador.escribir(semilla)
        } catch {
          error = { code: 'GUARDADO', message: 'Cargamos los datos de ejemplo, pero este navegador no deja guardar. Los cambios no van a quedar.' }
        }
        return { ok: true, sembrado: true }
      }
      const r = leerCopia(raw)
      if (!r.ok) {
        // No se resiembra solo: la copia guardada queda como está para no perder nada.
        error = { code: 'COPIA_INVALIDA', message: 'La copia guardada en este navegador no es válida.', errores: r.errores }
        return { ok: false, errores: r.errores }
      }
      if (r.migrada) {
        try {
          adaptador.escribir(r.state)
        } catch {
          return { ok: false, errores: ['No se pudo guardar la copia migrada.'] }
        }
      }
      state = r.state
      error = null
      return { ok: true, migrada: !!r.migrada }
    },
    despachar(cmd) {
      if (!state) return { ok: false, error: { code: 'SIN_ESTADO', message: 'No hay datos cargados.' } }
      const r = ejecutar(state, cmd, { now: reloj() })
      if (!r.ok || r.duplicado) return r
      try {
        adaptador.escribir(r.state)
      } catch {
        return { ok: false, error: ERROR_GUARDADO }
      }
      state = r.state
      return r
    },
    // Reemplaza todo el estado por una copia validada. Todo o nada.
    importar(texto) {
      const r = leerCopia(texto)
      if (!r.ok) return r
      try {
        adaptador.escribir(r.state)
      } catch {
        return { ok: false, errores: [ERROR_GUARDADO.message] }
      }
      state = r.state
      error = null
      return { ok: true, migrada: !!r.migrada }
    },
    restaurarSemilla() {
      const semilla = crearSemilla()
      try {
        adaptador.escribir(semilla)
      } catch {
        return { ok: false, error: ERROR_GUARDADO }
      }
      state = semilla
      error = null
      return { ok: true }
    },
    // Otra pestaña guardó: se adopta su copia si es válida.
    recargarDesdeAlmacen() {
      const raw = adaptador.leer()
      if (!raw) return { ok: false }
      const r = leerCopia(raw)
      if (r.ok) state = r.state
      return r
    },
  }
  return repo
}

export function memoriaStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}
