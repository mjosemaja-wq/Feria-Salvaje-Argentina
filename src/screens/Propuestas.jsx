// Control de revisiones: propuestas de corrección y cierres.
import { useState } from 'react'
import { useDominio } from '../store.js'
import { postulacion, propuestaDesactualizada, valorCampo } from '../domain/selectors.js'
import { formatoInstante, nuevoId } from '../domain/util.js'
import { useOperacion, Resultado, actorDe, etiquetaCampo, valorTexto } from '../operacion.jsx'
import { Seccion, Aviso } from '../ui.jsx'

export default function Propuestas({ perfil }) {
  const state = useDominio()
  const [filtro, setFiltro] = useState('pendiente')
  const lista = state.entities.propuestas.filter((p) => filtro === 'todas' || p.estado === filtro).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
  return (
    <Seccion titulo="Propuestas y cierres" bajada="Una propuesta no cambia nada hasta que otra persona de revisión la aprueba. Si el registro cambió desde que se armó, hay que actualizarla y mirarla de nuevo.">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar propuestas">
        {[['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas'], ['todas', 'Todas']].map(([v, l]) => (
          <button key={v} className={`btn ${filtro === v ? 'btn-primario' : 'btn-secundario'}`} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>
            {l} ({v === 'todas' ? state.entities.propuestas.length : state.entities.propuestas.filter((p) => p.estado === v).length})
          </button>
        ))}
      </div>
      {lista.length === 0 && <p className="etiqueta p-4 text-tinta-suave">No hay propuestas en este filtro.</p>}
      <ul className="space-y-4">{lista.map((p) => <Tarjeta key={p.id} state={state} prop={p} perfil={perfil} />)}</ul>
      <Cierres state={state} perfil={perfil} />
    </Seccion>
  )
}

function Tarjeta({ state, prop, perfil }) {
  const post = postulacion(state, prop.postulacionId)
  const conv = state.entities.convocatorias.find((c) => c.id === prop.convocatoriaId)
  const actor = actorDe(state, perfil)
  const desact = propuestaDesactualizada(state, prop)
  const esCreador = actor?.id === prop.creador.id
  const puedeDecidir = perfil.rol === 'revisor' && prop.estado === 'pendiente'
  const [motivo, setMotivo] = useState('')
  const [run, res] = useOperacion()
  const decidir = (decision) => run({ tipo: 'PROP_DECIDIR', actor, revisionEsperada: prop.rev, datos: { propuestaId: prop.id, decision, motivo } }, decision === 'aprobar' ? 'Propuesta aprobada: se creó un ajuste vinculado.' : 'Propuesta rechazada.')

  return (
    <li className="etiqueta space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <a href={`#/ficha/${post.id}`} className="font-titulo text-2xl font-extrabold underline-offset-2 hover:underline">{post.ficha.nombre}</a>
          <p className="text-sm text-tinta-suave">{conv.nombre}{conv.cerrada ? ' (cerrada: ajuste posterior al cierre)' : ''} · creada por {prop.creador.nombre} el {formatoInstante(prop.creadaEn)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${prop.estado === 'pendiente' ? 'bg-ocre text-tinta' : prop.estado === 'aprobada' ? 'bg-vina text-white' : 'bg-bordo text-white'}`}>{prop.estado}</span>
      </div>
      <p className="text-sm">«{prop.motivo}»</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-papel-oscuro text-left"><tr><th className="p-1.5">Campo</th><th className="p-1.5">Al proponer</th><th className="p-1.5">Vigente</th><th className="p-1.5">Propuesto</th></tr></thead>
          <tbody>
            {Object.entries(prop.cambios).map(([ruta, v]) => {
              const vigente = valorCampo(post, ruta)
              const cambio = String(vigente ?? '') !== String(prop.valoresPartida[ruta] ?? '')
              return (
                <tr key={ruta} className="border-t border-papel-oscuro">
                  <td className="p-1.5">{etiquetaCampo(post, ruta)}</td>
                  <td className="p-1.5">{valorTexto(prop.valoresPartida[ruta])}</td>
                  <td className={`p-1.5 ${cambio ? 'font-bold text-bordo' : ''}`}>{valorTexto(vigente)}{cambio ? ' (cambió)' : ''}</td>
                  <td className="p-1.5 font-semibold text-vina">{valorTexto(v)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-tinta-suave">Recursos afectados</dt><dd>{prop.recursosAfectados.join(' · ') || 'Ninguno'}</dd></div>
        <div><dt className="text-tinta-suave">Revisión esperada del registro</dt><dd>{prop.revisionPartida} {prop.estado === 'pendiente' && <>· vigente {post.rev}</>}</dd></div>
        <div><dt className="text-tinta-suave">Decisión</dt><dd>{prop.decisor ? `${prop.decision} por ${prop.decisor.nombre} · ${formatoInstante(prop.decididaEn)}${prop.motivoDecision ? ` · «${prop.motivoDecision}»` : ''}` : 'Pendiente'}</dd></div>
      </dl>
      {desact && (
        <Aviso tono="alerta" titulo="Desactualizada: el registro cambió desde que se armó esta propuesta"
          accion={['organizacion', 'revisor'].includes(perfil.rol) ? <button className="btn btn-secundario" onClick={() => run({ tipo: 'PROP_ACTUALIZAR', actor, revisionEsperada: prop.rev, datos: { propuestaId: prop.id } }, 'Propuesta actualizada a la revisión vigente. Revisala de nuevo antes de decidir.')}>Actualizar a la revisión vigente</button> : null}
        >Hay que actualizarla y revisarla otra vez antes de decidir.</Aviso>
      )}
      <Resultado res={res} />
      {puedeDecidir && (esCreador ? (
        <Aviso tono="info" titulo="La creaste vos: la tiene que decidir otra persona de revisión." />
      ) : (
        <div className="space-y-2 border-t border-papel-oscuro pt-3">
          <label className="block text-sm">Motivo de la decisión (obligatorio para rechazar)
            <input className="campo mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primario" onClick={() => decidir('aprobar')} disabled={desact}>Aprobar y aplicar</button>
            <button className="btn btn-secundario" onClick={() => decidir('rechazar')}>Rechazar</button>
          </div>
        </div>
      ))}
      {prop.estado === 'pendiente' && perfil.rol === 'organizacion' && <p className="text-xs text-tinta-suave">La decide el perfil Revisor.</p>}
    </li>
  )
}

function Cierres({ state, perfil }) {
  const actor = actorDe(state, perfil)
  const [run, res] = useOperacion()
  return (
    <div className="etiqueta space-y-3 p-4">
      <h2 className="text-2xl font-semibold">Cierres de edición</h2>
      <p className="text-sm text-tinta-suave">El cierre congela los totales de la edición. Registrarlo otra vez no tiene efecto. Solo lo hace el perfil Revisor.</p>
      <Resultado res={res} />
      <ul className="space-y-2">
        {state.entities.convocatorias.map((c) => {
          const cierre = state.entities.cierres.find((x) => x.convocatoriaId === c.id)
          return (
            <li key={c.id} className="rounded-md border-2 border-papel-oscuro bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{c.nombre}</strong>
                {cierre ? <span className="text-sm text-vina">Cerrada el {formatoInstante(cierre.instante)} por {cierre.actor.nombre}</span> : <span className="text-sm">Abierta</span>}
              </div>
              {cierre && <p className="mt-1 text-sm text-tinta-suave">Al cerrar: {cierre.totales.postulaciones} postulaciones · {cierre.totales.mesasAsignadas} mesas asignadas de {cierre.totales.cupo} · {cierre.totales.listaEspera} en espera</p>}
              {perfil.rol === 'revisor' && (
                <button
                  className="btn btn-secundario mt-2"
                  onClick={() => window.confirm(cierre ? 'Esta edición ya está cerrada. ¿Intentar registrar el cierre otra vez? (no va a tener efecto)' : `¿Cerrar «${c.nombre}»? Después ya no se aceptan cambios directos.`) &&
                    run({ tipo: 'CIERRE_REGISTRAR', actor, datos: { convocatoriaId: c.id, cierreId: nuevoId('cie') } }, 'Cierre registrado.')}
                >
                  {cierre ? 'Registrar cierre otra vez' : 'Registrar cierre'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
