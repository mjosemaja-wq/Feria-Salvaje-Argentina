import { useState } from 'react'
import { useDominio } from '../store.js'
import { mesas, bodega } from '../domain/selectors.js'
import { CONV_ACTUAL } from '../domain/seed.js'
import { formatoPesos, formatoPct, ratio } from '../domain/util.js'
import { Seccion, Aviso, EstadoChip } from '../ui.jsx'
import { useOperacion, Resultado, actorDe } from '../operacion.jsx'

export default function Mesas({ perfil }) {
  const state = useDominio()
  const [run, res] = useOperacion()
  const [convId, setConvId] = useState(CONV_ACTUAL)
  const conv = state.entities.convocatorias.find((c) => c.id === convId)
  const m = mesas(state, convId)
  const porMesa = new Map(m.asignadas.map((p) => [p.mesa, p]))
  const libres = m.libres.length

  return (
    <Seccion
      titulo="Pizarra de mesas"
      bajada={`${conv.nombre} · ${conv.jornadas}. Valor informativo por las dos jornadas: ${formatoPesos(conv.valorMesa)} (se arregla por fuera de la app).`}
      extra={
        <label className="text-sm">
          <span className="sr-only">Edición</span>
          <select className="campo" value={convId} onChange={(e) => setConvId(e.target.value)}>
            {state.entities.convocatorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.cerrada ? ' (cerrada)' : ''}</option>)}
          </select>
        </label>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Contador label="Mesas libres" valor={libres} tono={libres === 0 ? 'text-bordo' : 'text-vina'} />
        <Contador label="Asignadas" valor={`${m.asignadas.length}/${m.cupo}`} />
        <Contador label="Acreditadas" valor={m.entregadas.length} pie={`${formatoPct(ratio(m.entregadas.length, m.asignadas.length))} de las asignadas`} />
        <Contador label="En lista de espera" valor={m.espera.length} />
      </div>

      <p className="tiza text-2xl text-tinta" aria-live="polite">
        {libres === 0 ? 'No quedan mesas libres' : libres === 1 ? 'Queda 1 mesa' : `Quedan ${libres} mesas`}
      </p>
      <Resultado res={res} />
      {libres > 0 && m.espera.length > 0 && (
        <Aviso
          tono="alerta"
          titulo={`Hay ${libres} mesa(s) libre(s) y ${m.espera.length} bodega(s) esperando`}
          accion={perfil?.rol === 'organizacion' && !conv.cerrada ? (
            <button className="btn btn-primario" onClick={() => run({ tipo: 'MESA_OFRECER', actor: actorDe(state, perfil), datos: { convocatoriaId: convId } }, (r) => `La mesa ${r.mesa} pasó a la primera de la lista de espera.`)}>
              Ofrecer la mesa {m.libres[0]} a la primera de la lista
            </button>
          ) : null}
        >
          La lista avanza sola cuando una bodega se baja. Las mesas que se suman al subir el cupo se ofrecen desde acá.
        </Aviso>
      )}

      <div className="rounded-lg bg-tinta p-3 sm:p-5">
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-8" aria-label="Mesas">
          {Array.from({ length: m.cupo }, (_, i) => i + 1).map((n) => {
            const p = porMesa.get(n)
            const b = p && bodega(state, p.bodegaId)
            return (
              <li key={n}>
                {p ? (
                  <a href={`#/ficha/${p.id}`} title={b?.nombre} className={`flex h-full min-h-16 flex-col justify-between rounded border-2 border-papel p-1.5 text-xs text-white ${p.paraRevisar ? 'bg-[#7a6a2a]' : 'bg-vina'} hover:bg-bordo`}>
                    <span className="tiza text-lg leading-none">{n}</span>
                    <span className="line-clamp-2 leading-tight">{b?.nombre}</span>
                    {p.mesaEntregada && <span className="text-[10px] uppercase text-ocre">acreditada</span>}
                  </a>
                ) : (
                  <span className="flex h-full min-h-16 flex-col justify-between rounded border-2 border-dashed border-papel/60 p-1.5 text-xs text-papel">
                    <span className="tiza text-lg leading-none">{n}</span>
                    <span>libre</span>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <div className="etiqueta p-4">
        <h2 className="text-2xl font-semibold">Lista de espera</h2>
        {m.espera.length === 0 ? (
          <p className="mt-2 text-tinta-suave">Nadie espera un lugar.</p>
        ) : (
          <ol className="mt-3 divide-y divide-papel-oscuro">
            {m.espera.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="tiza w-8 text-2xl text-ocre">{i + 1}</span>
                <a href={`#/ficha/${p.id}`} className="flex-1 font-semibold underline-offset-2 hover:underline">{bodega(state, p.bodegaId)?.nombre}</a>
                <EstadoChip estado={p.estado} paraRevisar={p.paraRevisar} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </Seccion>
  )
}

function Contador({ label, valor, pie, tono = 'text-tinta' }) {
  return (
    <div className="etiqueta p-3">
      <p className="text-xs uppercase tracking-wide text-tinta-suave">{label}</p>
      <p className={`tiza text-3xl ${tono}`}>{valor}</p>
      {pie && <p className="text-xs text-tinta-suave">{pie}</p>}
    </div>
  )
}
