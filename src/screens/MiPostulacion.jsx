import { useState } from 'react'
import { useDominio } from '../store.js'
import { posicionEspera, evaluarRequisitos, convocatoria } from '../domain/selectors.js'
import { E, ESTADO_POR_ID, ESTADOS_EDITABLES_PRODUCTOR } from '../domain/constants.js'
import { formatoInstante, formatoPesos, formatoFecha, dentroDePlazo, nuevoId } from '../domain/util.js'
import { useOperacion, Resultado, actorDe } from '../operacion.jsx'
import { Seccion, EstadoChip, Aviso, Dato, ir } from '../ui.jsx'
import Historia from './Historia.jsx'

export default function MiPostulacion({ perfil }) {
  const state = useDominio()
  const actor = actorDe(state, perfil)
  const bod = state.entities.bodegas.find((b) => b.id === perfil.bodegaId)
  const [run, res] = useOperacion()
  // El productor solo ve lo de su bodega.
  const propias = state.entities.postulaciones.filter((p) => p.bodegaId === perfil.bodegaId).sort((a, b) => b.convocatoriaId.localeCompare(a.convocatoriaId))
  const abiertas = state.entities.convocatorias.filter((c) => !c.cerrada && !propias.some((p) => p.convocatoriaId === c.id))

  function postularme(conv) {
    const id = nuevoId('pos')
    const r = run({ tipo: 'POST_CREAR', actor, datos: { postulacionId: id, convocatoriaId: conv.id } })
    if (r.ok) ir(`postular/${r.respuesta.postulacionId}`)
  }

  return (
    <Seccion titulo={bod?.nombre ?? 'Tu bodega'} bajada={bod ? `${bod.localidad}, ${bod.provincia}` : ''}>
      <Resultado res={res} />
      {abiertas.map((c) => {
        const plazo = dentroDePlazo(c, Date.now())
        return (
          <div key={c.id} className="etiqueta flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="tiza text-xl">{c.nombre}: {plazo.ok ? 'la convocatoria está abierta' : plazo.motivo === 'cerro' ? 'la convocatoria cerró' : 'todavía no abre'}</p>
              <p className="text-sm text-tinta-suave">Del {formatoFecha(c.apertura)} al {formatoFecha(c.cierre)} · {c.jornadas}</p>
            </div>
            <button className="btn btn-primario" onClick={() => postularme(c)}>Empezar mi postulación</button>
          </div>
        )
      })}
      {propias.map((p) => <Tarjeta key={p.id} state={state} post={p} actor={actor} />)}
    </Seccion>
  )
}

function Tarjeta({ state, post, actor }) {
  const conv = convocatoria(state, post.convocatoriaId)
  const pos = posicionEspera(state, post)
  const reqs = evaluarRequisitos(post, conv).filter((r) => r.automatico)
  const pedido = [...post.comentarios].reverse().find((c) => c.tipo === 'cambios' || c.tipo === 'rechazo')
  const editable = ESTADOS_EDITABLES_PRODUCTOR.includes(post.estado) && !conv.cerrada
  const [run, res] = useOperacion()
  const [bajando, setBajando] = useState(false)
  const [motivo, setMotivo] = useState('')

  function bajarme() {
    const r = run({ tipo: 'POST_BAJA', actor, revisionEsperada: post.rev, datos: { postulacionId: post.id, motivo } }, (resp) =>
      resp.promovida ? 'Te diste de baja. Tu mesa pasó a la primera bodega de la lista de espera.' : 'Te diste de baja de esta edición.')
    if (r.ok) setBajando(false)
  }

  return (
    <article className="etiqueta space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold">{conv.nombre}{conv.cerrada ? ' · cerrada' : ''}</h2>
        <EstadoChip estado={post.estado} paraRevisar={post.paraRevisar} grande />
      </header>
      <Resultado res={res} />

      {post.estado === E.BORRADOR && <Aviso tono="info" titulo="Tu postulación está en borrador">Completala en cuatro pasos y enviala antes del {formatoFecha(conv.cierre)}.</Aviso>}
      {post.estado === E.REQUIERE_CAMBIOS && pedido && <Aviso tono="alerta" titulo="La organización te pide un cambio">«{pedido.texto}» — {pedido.autor}</Aviso>}
      {post.estado === E.ENVIADA && <Aviso tono="info" titulo="Recibimos tu postulación">La organización la va a revisar. Te avisamos acá cuando cambie de estado.</Aviso>}
      {post.estado === E.EN_REVISION && <Aviso tono="info" titulo="La organización está revisando tu postulación" />}
      {post.estado === E.RECHAZADA && pedido && <Aviso tono="error" titulo="Tu postulación no quedó en esta edición">«{pedido.texto}»</Aviso>}
      {post.estado === E.APROBADA && <p className="tiza text-3xl text-vina">¡Estás adentro! Tenés la mesa {post.mesa}</p>}
      {pos && <p className="tiza text-3xl" style={{ color: ESTADO_POR_ID[E.LISTA_ESPERA].color }}>Estás en el lugar {pos} de la lista de espera</p>}
      {post.paraRevisar && <Aviso tono="alerta" titulo="La organización cambió un requisito y va a revisar tu postulación de nuevo">Tu estado y tu mesa se mantienen mientras tanto.</Aviso>}

      <div className="flex flex-wrap gap-2">
        {editable && <button className="btn btn-primario" onClick={() => ir(`postular/${post.id}`)}>{post.estado === E.REQUIERE_CAMBIOS ? 'Corregir y reenviar' : 'Completar mi postulación'}</button>}
        {!editable && <button className="btn btn-secundario" onClick={() => ir(`postular/${post.id}`)}>Ver lo que envié</button>}
        {[E.APROBADA, E.LISTA_ESPERA].includes(post.estado) && !conv.cerrada && !bajando && <button className="btn btn-secundario" onClick={() => setBajando(true)}>Bajarme de la feria</button>}
      </div>
      {bajando && (
        <div className="rounded-md border-2 border-bordo bg-white p-3">
          <p className="font-semibold">¿Seguro que te bajás? {post.mesa ? `Liberás la mesa ${post.mesa} y pasa a la primera bodega de la lista de espera.` : 'Salís de la lista de espera.'} No se puede deshacer desde la app.</p>
          <label className="mt-2 block text-sm">Motivo (opcional)
            <input className="campo mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <div className="mt-2 flex gap-2">
            <button className="btn btn-primario" onClick={bajarme}>Sí, bajarme</button>
            <button className="btn btn-secundario" onClick={() => setBajando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato label="Etiquetas">{post.etiquetas.length}</Dato>
        <Dato label="Botellas/año">{post.ficha.botellasAnio ? Number(post.ficha.botellasAnio).toLocaleString('es-AR') : '—'}</Dato>
        <Dato label={post.valorMesaCongelado != null ? 'Valor de mesa (al aprobar)' : 'Valor de mesa vigente'}>{formatoPesos(post.valorMesaCongelado ?? conv.valorMesa)}</Dato>
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

      {post.comentarios.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold">Comentarios de la organización</h3>
          <ul className="mt-1 space-y-2 text-sm">
            {post.comentarios.map((c) => (
              <li key={c.id} className="rounded border-l-4 border-ocre bg-white p-2">«{c.texto}»<span className="block text-xs text-tinta-suave">{c.autor} · {formatoInstante(c.instante)}</span></li>
            ))}
          </ul>
        </div>
      )}

      <Historia state={state} postId={post.id} />
    </article>
  )
}
