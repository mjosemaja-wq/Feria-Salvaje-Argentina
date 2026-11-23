import { historial } from '../domain/selectors.js'
import { ESTADO_POR_ID } from '../domain/constants.js'
import { formatoInstante } from '../domain/util.js'

const DESCRIPCION = {
  datos_editados: 'Editó los datos',
  checklist: 'Marcó el checklist',
  comentario: 'Dejó un comentario',
  para_revisar: 'Marcada «Para revisar» por un cambio de requisito',
  revision_confirmada: 'Revisión confirmada con los requisitos vigentes',
  mesa_entregada: 'Mesa acreditada en la feria',
  ajuste_aplicado: 'Se aplicó una corrección autorizada',
}

// Historia de una postulación: cada transición con fecha, autor y motivo.
export default function Historia({ state, postId, completa = false }) {
  const evs = historial(state, postId).filter((ev) => completa || ev.estadoNuevo || ev.motivo || ['para_revisar', 'ajuste_aplicado', 'mesa_entregada'].includes(ev.tipo))
  return (
    <div>
      <h3 className="text-lg font-semibold">Historia</h3>
      <ol className="mt-2 space-y-2 border-l-2 border-papel-oscuro pl-4 text-sm">
        {evs.map((ev) => {
          const mesa = ev.efectos?.find((f) => f.tipo === 'mesa_asignada' || f.tipo === 'mesa_liberada')
          return (
            <li key={ev.id}>
              <span className="text-tinta-suave">{formatoInstante(ev.instante)} · {ev.actor.nombre}</span>
              <span className="block">
                {ev.estadoNuevo && ESTADO_POR_ID[ev.estadoNuevo]
                  ? <>{ev.estadoAnterior ? `${ESTADO_POR_ID[ev.estadoAnterior].label} → ` : 'Creada como '}<strong>{ESTADO_POR_ID[ev.estadoNuevo].label}</strong></>
                  : <strong>{DESCRIPCION[ev.tipo] ?? ev.tipo}</strong>}
                {mesa && ` · ${mesa.tipo === 'mesa_asignada' ? 'mesa' : 'libera la mesa'} ${mesa.mesa}`}
              </span>
              {ev.motivo && <span className="block italic text-tinta-suave">«{ev.motivo}»</span>}
            </li>
          )
        })}
        {evs.length === 0 && <li className="text-tinta-suave">Sin movimientos registrados desde la apertura de la edición. Lo anterior está resumido en la instantánea de apertura.</li>}
      </ol>
    </div>
  )
}
