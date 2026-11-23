import { useState } from 'react'
import { useDominio } from '../store.js'
import { conciliar, evidencias } from '../domain/conciliacion.js'
import { CONV_ACTUAL } from '../domain/seed.js'
import { formatoInstante } from '../domain/util.js'
import { ESTADO_POR_ID } from '../domain/constants.js'
import { Seccion, Aviso } from '../ui.jsx'

export default function Conciliacion() {
  const state = useDominio()
  const [convId, setConvId] = useState(CONV_ACTUAL)
  const c = conciliar(state, convId)
  const ev = evidencias(state, convId)

  return (
    <Seccion
      titulo="Conciliación"
      bajada="Los totales se reconstruyen desde la instantánea de apertura más los eventos confirmados, y se comparan con lo que dicen los registros. Una diferencia se muestra tal cual."
      extra={
        <select className="campo" aria-label="Edición" value={convId} onChange={(e) => setConvId(e.target.value)}>
          {state.entities.convocatorias.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
      }
    >
      {c.cuadra ? (
        <Aviso tono="ok" titulo="Cuadra: eventos y registros dan lo mismo" />
      ) : (
        <Aviso tono="error" titulo="No cuadra: hay diferencias entre eventos y registros">Las filas marcadas muestran cuánto difieren.</Aviso>
      )}
      <p className="text-sm text-tinta-suave">
        Punto de partida: apertura del {formatoInstante(c.apertura?.instante)} (revisión {c.apertura?.revision ?? '—'}).
      </p>
      <div className="etiqueta overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-papel-oscuro text-left">
            <tr>
              <th className="p-2">Indicador</th>
              <th className="p-2 text-right">Por eventos</th>
              <th className="p-2 text-right">Por registros</th>
              <th className="p-2 text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {c.filas.map((f) => (
              <tr key={f.clave} className={`border-t border-papel-oscuro ${f.diferencia ? 'bg-[#FFF1EF]' : ''}`}>
                <td className="p-2">
                  {f.estado && <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: ESTADO_POR_ID[f.estado].color }} />}
                  {f.label}
                </td>
                <td className="p-2 text-right tabular-nums">{f.eventos}</td>
                <td className="p-2 text-right tabular-nums">{f.registros}</td>
                <td className={`p-2 text-right font-semibold tabular-nums ${f.diferencia ? 'text-[#B3261E]' : 'text-vina'}`}>{f.diferencia > 0 ? `+${f.diferencia}` : f.diferencia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="etiqueta p-4">
        <h2 className="text-2xl font-semibold">Repetir no duplica</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {ev.map((e) => (
            <li key={e.label} className="flex items-center justify-between gap-3 border-b border-papel-oscuro py-1.5">
              <span>{e.label} <span className="text-tinta-suave">(esperado: {e.esperado})</span></span>
              <span className={`font-semibold ${e.ok ? 'text-vina' : 'text-[#B3261E]'}`}>{e.valor} {e.ok ? '✓' : '✗'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-tinta-suave">Filtros, historial de ajustes y exportación CSV llegan en la fase 3.</p>
      </div>
    </Seccion>
  )
}
