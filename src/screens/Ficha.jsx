// Ficha de revisión: el mismo checklist para todas las bodegas.
import { useState } from 'react'
import { useDominio } from '../store.js'
import { postulacion, convocatoria, evaluarRequisitos, posicionEspera, mesas, propuestasDe, requisito } from '../domain/selectors.js'
import { E } from '../domain/constants.js'
import { formatoPesos, formatoInstante, nuevoId } from '../domain/util.js'
import { useOperacion, Resultado, actorDe, etiquetaCampo, valorTexto } from '../operacion.jsx'
import { Seccion, EstadoChip, Aviso, Dato, ir } from '../ui.jsx'
import Historia from './Historia.jsx'

export default function Ficha({ perfil, postId }) {
  const state = useDominio()
  const post = postulacion(state, postId)
  if (!post) return <Seccion titulo="Ficha"><Aviso tono="error" titulo="No encontramos esa postulación." /></Seccion>
  return <Contenido key={post.id} state={state} post={post} perfil={perfil} />
}

function Contenido({ state, post, perfil }) {
  const conv = convocatoria(state, post.convocatoriaId)
  const actor = actorDe(state, perfil)
  const esOrg = perfil.rol === 'organizacion'
  const reqs = evaluarRequisitos(post, conv)
  const pos = posicionEspera(state, post)
  const m = mesas(state, conv.id)
  const tope = requisito(conv, 'sulfitos')?.param?.max
  const [run, res] = useOperacion()
  const [comentario, setComentario] = useState('')
  const abierta = !conv.cerrada
  const checklistEditable = esOrg && abierta && (post.estado === E.EN_REVISION || ([E.APROBADA, E.LISTA_ESPERA].includes(post.estado) && post.paraRevisar))

  const cmd = (tipo, datos = {}) => ({ tipo, actor, revisionEsperada: post.rev, datos: { postulacionId: post.id, ...datos } })
  const conComentario = (tipo, ok) => {
    const r = run(cmd(tipo, tipo === 'POST_BAJA' ? { motivo: comentario } : { comentario }), ok)
    if (r.ok) setComentario('')
  }

  return (
    <Seccion
      titulo={post.ficha.nombre}
      bajada={`${post.ficha.localidad}, ${post.ficha.provincia} · ${conv.nombre}${conv.cerrada ? ' (cerrada)' : ''}`}
      extra={<EstadoChip estado={post.estado} paraRevisar={post.paraRevisar} grande />}
    >
      <a href="#/bandeja" className="text-sm text-bordo underline">← Volver a la bandeja</a>
      <div aria-live="polite"><Resultado res={res} /></div>
      {post.paraRevisar && <Aviso tono="alerta" titulo={`Para revisar: cambió un requisito (versión ${conv.requisitosVersion}). La decisión anterior y la mesa se mantienen hasta que confirmes.`} />}
      {post.estado === E.APROBADA && <p className="tiza text-3xl text-vina">Mesa {post.mesa}{post.mesaEntregada ? ' · acreditada' : ''}</p>}
      {pos && <p className="tiza text-2xl text-[#2F6670]">Lista de espera: posición {pos}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <div className="etiqueta p-4">
            <h2 className="text-2xl font-semibold">Checklist</h2>
            <p className="text-xs text-tinta-suave">Requisitos versión {conv.requisitosVersion}. Los automáticos salen de los datos; los manuales los marca la organización.</p>
            <ul className="mt-3 space-y-2">
              {reqs.map((r) => (
                <li key={r.req.id} className={`rounded-md border-2 p-2 ${r.cumple ? 'border-vina/40 bg-[#EEF3EC]' : r.automatico ? 'border-bordo/50 bg-[#FBEFF1]' : 'border-ocre/60 bg-white'}`}>
                  <div className="flex items-start gap-2">
                    {r.automatico || !checklistEditable ? (
                      <span aria-hidden="true" className={`mt-0.5 font-bold ${r.cumple ? 'text-vina' : 'text-bordo'}`}>{r.cumple ? '✓' : r.automatico ? '✗' : '○'}</span>
                    ) : (
                      <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 accent-vina"
                        aria-label={`Marcar «${r.req.texto}» como cumplido`}
                        checked={r.cumple}
                        onChange={(e) => run(cmd('POST_CHECKLIST', { requisitoId: r.req.id, valor: e.target.checked }))}
                      />
                    )}
                    <div>
                      <p className="font-semibold">{r.req.texto} <span className="text-xs font-normal text-tinta-suave">({r.automatico ? 'automático' : 'manual'})</span></p>
                      <p className="text-sm text-tinta-suave">{r.cumple ? 'Cumplido' : 'Pendiente'} · {r.detalle}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {esOrg && abierta && (
            <div className="etiqueta space-y-3 p-4">
              <h2 className="text-2xl font-semibold">Acciones</h2>
              {res && <div className="lg:hidden"><Resultado res={res} /></div>}
              {post.estado === E.ENVIADA && <button className="btn btn-primario" onClick={() => run(cmd('POST_TOMAR'), 'La tomaste para revisión.')}>Tomar para revisión</button>}
              {post.estado === E.EN_REVISION && (
                <button className="btn btn-primario" onClick={() => run(cmd('POST_APROBAR'), (r) => (r.estado === E.APROBADA ? `Aprobada con la mesa ${r.mesa}.` : `Sin mesas libres: entra a la lista de espera en la posición ${r.posicion}.`))}>
                  Aprobar {m.libres.length ? `(mesa ${m.libres[0]})` : '(va a lista de espera)'}
                </button>
              )}
              {post.paraRevisar && <button className="btn btn-primario" onClick={() => run(cmd('POST_CONFIRMAR_REVISION'), 'Revisión confirmada con los requisitos vigentes.')}>Confirmar con los requisitos vigentes</button>}
              {post.estado === E.APROBADA && !post.mesaEntregada && <button className="btn btn-secundario" onClick={() => run(cmd('MESA_ENTREGAR'), `Mesa ${post.mesa} acreditada.`)}>Acreditar mesa el día de la feria</button>}
              {post.estado !== E.BORRADOR && (
                <label className="block text-sm font-semibold">Comentario para la bodega
                  <textarea className="campo mt-1 min-h-24" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Ej.: Te falta la cosecha del blanco." />
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                {post.estado === E.EN_REVISION && <button className="btn btn-secundario" onClick={() => conComentario('POST_PEDIR_CAMBIOS', 'Le pediste cambios a la bodega.')}>Pedir cambios</button>}
                {post.estado === E.EN_REVISION && <button className="btn btn-secundario" onClick={() => conComentario('POST_RECHAZAR', 'Postulación rechazada.')}>Rechazar</button>}
                {[E.APROBADA, E.LISTA_ESPERA].includes(post.estado) && (
                  <button className="btn btn-secundario" onClick={() => window.confirm('¿Dar de baja a esta bodega? Libera su lugar y no se puede deshacer.') && conComentario('POST_BAJA', (r) => (r.promovida ? 'Baja registrada. La primera de la lista de espera tomó la mesa.' : 'Baja registrada.'))}>
                    Dar de baja (usa el comentario como motivo)
                  </button>
                )}
                {post.estado !== E.BORRADOR && <button className="btn btn-secundario" onClick={() => conComentario('POST_COMENTAR', 'Comentario guardado.')}>Solo comentar</button>}
              </div>
              <p className="text-xs text-tinta-suave">Pedir cambios, rechazar y dar de baja exigen comentario; la bodega lo ve en su panel.</p>
            </div>
          )}
          {perfil.rol === 'auditor' && <Aviso tono="info" titulo="Perfil Auditor: solo lectura." />}
        </div>

        <div className="space-y-4">
          <div className="etiqueta p-4">
            <h2 className="text-2xl font-semibold">Ficha de la bodega</h2>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <Dato label="Hectáreas">{valorTexto(post.ficha.hectareas)}</Dato>
              <Dato label="Uva">{post.ficha.uva === 'comprada' ? `Comprada · ${post.ficha.vinedo || 'sin viñedo identificado'}` : post.ficha.uva === 'propia' ? 'Propia' : '—'}</Dato>
              <Dato label="Botellas por año">{post.ficha.botellasAnio ? Number(post.ficha.botellasAnio).toLocaleString('es-AR') : '—'}</Dato>
              <Dato label="Contacto (ejemplo)">{post.ficha.contacto?.nombre || '—'}<span className="block text-xs font-normal">{post.ficha.contacto?.email}</span></Dato>
              <Dato label="Valor de mesa">{post.valorMesaCongelado != null ? `${formatoPesos(post.valorMesaCongelado)} (congelado al aprobar)` : `${formatoPesos(conv.valorMesa)} (vigente)`}</Dato>
              <Dato label="Enviada">{formatoInstante(post.enviadaEn)}</Dato>
            </dl>
          </div>
          <div className="etiqueta overflow-x-auto p-4">
            <h2 className="text-2xl font-semibold">Etiquetas</h2>
            <table className="mt-2 w-full min-w-[300px] text-sm">
              <thead className="text-left text-tinta-suave"><tr><th className="py-1">Nombre</th><th>Cepa</th><th>Cosecha</th><th className="text-right">SO₂ mg/l</th></tr></thead>
              <tbody>
                {post.etiquetas.map((e) => {
                  const alto = e.sulfitos !== '' && Number(e.sulfitos) > tope
                  return (
                    <tr key={e.id} className={`border-t border-papel-oscuro ${alto ? 'bg-[#FBEFF1]' : ''}`}>
                      <td className="py-1 font-semibold">{e.nombre}</td>
                      <td>{e.cepa}</td>
                      <td>{e.cosecha || <strong className="text-bordo">falta</strong>}</td>
                      <td className={`text-right tabular-nums ${alto ? 'font-bold text-bordo' : ''}`}>{e.sulfitos === '' ? '—' : e.sulfitos}{alto ? ' ✗' : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {post.comentarios.length > 0 && (
            <div className="etiqueta p-4">
              <h2 className="text-2xl font-semibold">Comentarios</h2>
              <ul className="mt-2 space-y-2 text-sm">{post.comentarios.map((c) => <li key={c.id} className="border-l-4 border-ocre pl-2">«{c.texto}» <span className="block text-xs text-tinta-suave">{c.autor} · {formatoInstante(c.instante)}</span></li>)}</ul>
            </div>
          )}
          <PropuestasDeFicha state={state} post={post} perfil={perfil} actor={actor} />
          <div className="etiqueta p-4"><Historia state={state} postId={post.id} completa /></div>
        </div>
      </div>
    </Seccion>
  )
}

// Propuestas de corrección sobre un registro confirmado. No mueven recursos.
function PropuestasDeFicha({ state, post, perfil, actor }) {
  const props = propuestasDe(state, post.id)
  const puedeProponer = ['organizacion', 'revisor'].includes(perfil.rol) && post.estado !== E.BORRADOR
  const opciones = [
    ...['ficha.botellasAnio', 'ficha.hectareas', 'ficha.localidad', 'ficha.vinedo'],
    ...post.etiquetas.flatMap((e) => ['nombre', 'cepa', 'cosecha', 'sulfitos'].map((c) => `etiqueta.${c}.${e.id}`)),
  ]
  const [ruta, setRuta] = useState(opciones[0])
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [run, res] = useOperacion()
  const actual = ruta.startsWith('ficha.') ? post.ficha[ruta.split('.')[1]] : post.etiquetas.find((e) => e.id === ruta.split('.')[2])?.[ruta.split('.')[1]]

  function proponer(e) {
    e.preventDefault()
    const r = run({ tipo: 'PROP_CREAR', actor, revisionEsperada: post.rev, datos: { propuestaId: nuevoId('prop'), postulacionId: post.id, cambios: { [ruta]: valor }, motivo } }, 'Propuesta creada. La decide otra persona de revisión; mientras tanto no cambia nada.')
    if (r.ok) { setValor(''); setMotivo('') }
  }

  return (
    <div className="etiqueta space-y-3 p-4">
      <h2 className="text-2xl font-semibold">Correcciones</h2>
      {props.length === 0 && <p className="text-sm text-tinta-suave">Sin propuestas de corrección.</p>}
      <ul className="space-y-1 text-sm">
        {props.map((p) => (
          <li key={p.id}><a className="underline" href="#/propuestas">{Object.keys(p.cambios).map((r) => etiquetaCampo(post, r)).join(', ')}</a> · {p.estado} · creó {p.creador.nombre}{p.decisor ? ` · decidió ${p.decisor.nombre}` : ''}</li>
        ))}
      </ul>
      {puedeProponer && (
        <form onSubmit={proponer} className="space-y-2 border-t border-papel-oscuro pt-3">
          <p className="text-sm font-semibold">Proponer una corrección (no cambia nada hasta que se apruebe)</p>
          <label className="block text-sm">Campo
            <select className="campo mt-1" value={ruta} onChange={(e) => setRuta(e.target.value)}>
              {opciones.map((o) => <option key={o} value={o}>{etiquetaCampo(post, o)}</option>)}
            </select>
          </label>
          <p className="text-xs text-tinta-suave">Valor actual: {valorTexto(actual)} · Revisión del registro: {post.rev}</p>
          <label className="block text-sm">Valor propuesto
            <input className="campo mt-1" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </label>
          <label className="block text-sm">Motivo
            <input className="campo mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: llegó el análisis de laboratorio" />
          </label>
          <button className="btn btn-secundario" type="submit">Crear propuesta</button>
          <Resultado res={res} />
        </form>
      )}
    </div>
  )
}

export const irFicha = (id) => ir(`ficha/${id}`)
