import { useState } from 'react'
import { useDominio, adaptador, restaurarSemilla, importar } from '../store.js'
import { correrPruebas } from '../domain/pruebas.js'
import { TRANSICIONES, ESTADO_POR_ID, STORAGE_KEY } from '../domain/constants.js'
import { Seccion, Aviso, descargar } from '../ui.jsx'

export default function Diagnostico() {
  const state = useDominio()
  const [resultados, setResultados] = useState(null)
  const [msg, setMsg] = useState(null)
  const [, forzar] = useState(0)

  const correr = () => setResultados(correrPruebas())
  const verdes = resultados?.filter((r) => r.ok).length

  function restaurar() {
    if (!window.confirm('¿Restaurar los datos de ejemplo? Se reemplazan solo los datos de esta app en este navegador. Lo que cambiaste se pierde.')) return
    const r = restaurarSemilla()
    setMsg(r.ok ? { tono: 'ok', t: 'Datos de ejemplo restaurados.' } : { tono: 'error', t: r.error.message })
  }
  function onImportar(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    f.text().then((texto) => {
      if (!window.confirm('¿Reemplazar todos los datos de esta app por la copia elegida?')) return
      const r = importar(texto)
      setMsg(r.ok ? { tono: 'ok', t: r.migrada ? 'Copia v1 migrada a v2 e importada.' : 'Copia importada.' } : { tono: 'error', t: `Copia rechazada, no se tocó nada: ${r.errores.slice(0, 3).join(' · ')}` })
    })
  }

  return (
    <Seccion titulo="Diagnóstico" bajada="Pruebas de dominio, estado de la copia guardada y herramientas de recuperación. Todo actúa solo sobre la clave de esta app.">
      {msg && <Aviso tono={msg.tono} titulo={msg.t} />}

      <div className="etiqueta space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Pruebas de dominio</h2>
          <button className="btn btn-primario" onClick={correr}>Correr pruebas</button>
        </div>
        <p className="text-sm text-tinta-suave">Corren sobre una copia de la semilla con reloj fijo. No tocan tus datos.</p>
        {resultados && (
          <>
            <p className={`font-semibold ${verdes === resultados.length ? 'text-vina' : 'text-[#B3261E]'}`} aria-live="polite">{verdes} de {resultados.length} en verde</p>
            <ul className="space-y-1 text-sm">
              {resultados.map((r) => (
                <li key={r.nombre} className="flex gap-2">
                  <span className={r.ok ? 'text-vina' : 'text-[#B3261E]'}>{r.ok ? '✓' : '✗'}</span>
                  <span>{r.nombre}{r.error && <span className="block text-[#B3261E]">{r.error}</span>}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="etiqueta space-y-2 p-4">
        <h2 className="text-2xl font-semibold">Copia guardada</h2>
        <ul className="text-sm">
          <li>Clave: <code>{STORAGE_KEY}</code></li>
          <li>schemaVersion {state.schemaVersion} · revisión {state.revision} · {state.eventos.length} eventos · {state.comandos.length} comandos</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          <button className="btn btn-secundario" onClick={() => descargar(`feria-salvaje-copia-r${state.revision}.json`, JSON.stringify(state, null, 2), 'application/json')}>Exportar copia</button>
          <label className="btn btn-secundario">
            Importar copia
            <input type="file" accept="application/json,.json" className="sr-only" onChange={onImportar} />
          </label>
          <button className="btn btn-secundario" onClick={() => { adaptador.simularFallo(1); forzar((x) => x + 1) }}>
            Simular fallo en el próximo guardado{adaptador.fallosPendientes ? ' (armado)' : ''}
          </button>
          <button className="btn btn-secundario" onClick={restaurar}>Restaurar datos de ejemplo</button>
        </div>
      </div>

      <div className="etiqueta overflow-x-auto p-4">
        <h2 className="text-2xl font-semibold">Transiciones válidas</h2>
        <table className="mt-2 w-full min-w-[520px] text-sm">
          <thead className="text-left"><tr><th className="p-1">Comando</th><th className="p-1">Desde</th><th className="p-1">Hacia</th><th className="p-1">Quién</th></tr></thead>
          <tbody>
            {TRANSICIONES.map((t) => (
              <tr key={t.comando} className="border-t border-papel-oscuro">
                <td className="p-1"><code>{t.comando}</code></td>
                <td className="p-1">{t.desde.map((d) => ESTADO_POR_ID[d].label).join(', ')}</td>
                <td className="p-1">{t.hacia.split(' | ').map((h) => ESTADO_POR_ID[h].label).join(' o ')}</td>
                <td className="p-1">{t.rol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Seccion>
  )
}
