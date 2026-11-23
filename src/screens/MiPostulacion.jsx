import { useDominio } from '../store.js'
import { historial, posicionEspera, evaluarRequisitos, convocatoria } from '../domain/selectors.js'
import { E, ESTADO_POR_ID } from '../domain/constants.js'
import { formatoInstante, formatoPesos } from '../domain/util.js'
import { Seccion, EstadoChip, Aviso, Dato, Proxima } from '../ui.jsx'

// Fase 1: seguimiento en solo lectura. El formulario de 4 pasos llega en la fase 2.
export default function MiPostulacion({ perfil }) {
  const state = useDominio()
  const bod = state.entities.bodegas.find((b) => b.id === perfil.bodegaId)
  // El productor solo ve lo de su bodega.
  const propias = state.entities.postulaciones.filter((p) => p.bodegaId === perfil.bodegaId)

  return (
    <Seccion titulo={bod?.nombre ?? 'Tu bodega'} bajada={bod ? `${bod.localidad}, ${bod.provincia}` : ''}>
      {propias.length === 0 && <Aviso titulo="Todavía no te postulaste">Desde la fase 2 vas a poder armar tu postulación en cuatro pasos.</Aviso>}
      {propias.map((p) => <Tarjeta key={p.id} state={state} post={p} />)}
      <Proxima fase={2}>Postulación en cuatro pasos desde el celular, corrección cuando te piden cambios y baja desde tu panel.</Proxima>
    </Seccion>
  )
}

function Tarjeta({ state, post }) {
  const conv = convocatoria(state, post.convocatoriaId)
  const pos = posicionEspera(state, post)
  const reqs = evaluarRequisitos(post, conv).filter((r) => r.automatico)
  const pedido = [...post.comentarios].reverse().find((c) => c.tipo === 'cambios' || c.tipo === 'rechazo')
  return (
    <article className="etiqueta space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">{conv.nombre}{conv.cerrada ? ' · cerrada' : ''}</h2>
        <EstadoChip estado={post.estado} paraRevisar={post.paraRevisar} grande />
      </header>

      {post.estado === E.REQUIERE_CAMBIOS && pedido && <Aviso tono="alerta" titulo="La organización te pide un cambio">«{pedido.texto}» — {pedido.autor}</Aviso>}
      {post.estado === E.RECHAZADA && pedido && <Aviso tono="error" titulo="Tu postulación no quedó en esta edición">«{pedido.texto}»</Aviso>}
      {post.estado === E.APROBADA && <p className="tiza text-3xl text-vina">Tenés la mesa {post.mesa}</p>}
      {pos && <p className="tiza text-3xl" style={{ color: ESTADO_POR_ID[E.LISTA_ESPERA].color }}>Estás en el lugar {pos} de la lista de espera</p>}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato label="Etiquetas">{post.etiquetas.length}</Dato>
        <Dato label="Botellas/año">{post.ficha.botellasAnio ? Number(post.ficha.botellasAnio).toLocaleString('es-AR') : '—'}</Dato>
        <Dato label="Valor de mesa">{post.valorMesaCongelado != null ? formatoPesos(post.valorMesaCongelado) : formatoPesos(conv.valorMesa)}</Dato>
        <Dato label="Última actualización">{formatoInstante(post.actualizadaEn)}</Dato>
      </dl>

      {post.etiquetas.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {post.etiquetas.map((e) => (
            <li key={e.id} className="rounded border border-papel-oscuro bg-white p-2 text-sm">
              <span className="font-titulo text-lg font-semibold">{e.nombre || 'Sin nombre'}</span>
              <span className="block text-tinta-suave">{e.cepa || 'Sin cepa'} · {e.cosecha ? `cosecha ${e.cosecha}` : <strong className="text-bordo">sin cosecha</strong>} · {e.sulfitos === '' ? 'sin dato de sulfitos' : `${e.sulfitos} mg/l`}</span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="text-lg font-semibold">Requisitos que se calculan solos</h3>
        <ul className="mt-1 space-y-1 text-sm">
          {reqs.map((r) => (
            <li key={r.req.id} className="flex gap-2"><span className={r.cumple ? 'text-vina' : 'text-bordo'}>{r.cumple ? '✓' : '✗'}</span><span>{r.req.texto}: <span className="text-tinta-suave">{r.detalle}</span></span></li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Historia</h3>
        <ol className="mt-2 space-y-2 border-l-2 border-papel-oscuro pl-4 text-sm">
          {historial(state, post.id).filter((ev) => ev.estadoNuevo || ev.motivo).map((ev) => (
            <li key={ev.id}>
              <span className="text-tinta-suave">{formatoInstante(ev.instante)} · {ev.actor.nombre}</span>
              <span className="block">
                {ev.estadoNuevo ? <>{ev.estadoAnterior ? `${ESTADO_POR_ID[ev.estadoAnterior].label} → ` : ''}<strong>{ESTADO_POR_ID[ev.estadoNuevo].label}</strong></> : ev.tipo === 'para_revisar' ? <strong>Marcada «Para revisar»</strong> : ev.tipo}
                {ev.efectos?.find((f) => f.tipo === 'mesa_asignada') && ` · mesa ${ev.efectos.find((f) => f.tipo === 'mesa_asignada').mesa}`}
              </span>
              {ev.motivo && <span className="block italic text-tinta-suave">«{ev.motivo}»</span>}
            </li>
          ))}
          {historial(state, post.id).length === 0 && <li className="text-tinta-suave">Los movimientos anteriores a la apertura de este registro no tienen historia detallada.</li>}
        </ol>
      </div>
    </article>
  )
}
