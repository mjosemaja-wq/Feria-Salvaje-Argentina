// Configuración de la convocatoria: cupo, fechas, valor y requisitos versionados.
import { useState, useEffect } from 'react'
import { useDominio } from '../store.js'
import { mesas } from '../domain/selectors.js'
import { CONV_ACTUAL } from '../domain/seed.js'
import { formatoPesos, formatoInstante } from '../domain/util.js'
import { useOperacion, Resultado, actorDe } from '../operacion.jsx'
import { Seccion, Aviso } from '../ui.jsx'

export default function Convocatoria({ perfil }) {
  const state = useDominio()
  const [convId, setConvId] = useState(CONV_ACTUAL)
  const conv = state.entities.convocatorias.find((c) => c.id === convId)
  return (
    <Seccion
      titulo="Convocatoria"
      bajada="Cupo, fechas, valor informativo y requisitos. Cada edición tiene su propia versión de requisitos."
      extra={
        <select className="campo" aria-label="Edición" value={convId} onChange={(e) => setConvId(e.target.value)}>
          {state.entities.convocatorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.cerrada ? ' (cerrada)' : ''}</option>)}
        </select>
      }
    >
      <Datos key={conv.id} state={state} conv={conv} perfil={perfil} />
      <Requisitos state={state} conv={conv} perfil={perfil} />
    </Seccion>
  )
}

function Datos({ state, conv, perfil }) {
  const m = mesas(state, conv.id)
  const minimo = Math.max(m.asignadas.length, m.mayorAsignada)
  const [f, setF] = useState({ nombre: conv.nombre, jornadas: conv.jornadas, apertura: conv.apertura, cierre: conv.cierre, cupo: conv.cupo, valorMesa: conv.valorMesa })
  const [revBase, setRevBase] = useState(conv.rev)
  const [run, res, setRes] = useOperacion()
  const sucio = Object.keys(f).some((k) => String(f[k]) !== String(conv[k]))
  // Si la convocatoria cambió y no hay nada escrito sin guardar, se toma la versión vigente.
  // Si hay cambios sin guardar, se conserva lo escrito y el guardado avisa el conflicto.
  useEffect(() => {
    if (!sucio && revBase !== conv.rev) setRevBase(conv.rev)
  }, [conv.rev, sucio, revBase])
  const editable = perfil.rol === 'organizacion' && !conv.cerrada

  function guardar(e) {
    e.preventDefault()
    const cambios = {}
    for (const k of Object.keys(f)) if (String(f[k]) !== String(conv[k])) cambios[k] = ['cupo', 'valorMesa'].includes(k) ? Number(f[k]) : f[k]
    if (!Object.keys(cambios).length) return
    const r = run({ tipo: 'CONV_ACTUALIZAR', actor: actorDe(state, perfil), revisionEsperada: revBase, datos: { convocatoriaId: conv.id, cambios } }, 'Convocatoria actualizada.')
    if (r.ok) setRevBase(r.respuesta.rev)
  }
  function traerNuevos() {
    setF({ nombre: conv.nombre, jornadas: conv.jornadas, apertura: conv.apertura, cierre: conv.cierre, cupo: conv.cupo, valorMesa: conv.valorMesa })
    setRevBase(conv.rev)
    setRes({ tono: 'info', t: 'Cargamos los datos vigentes de la convocatoria.' })
  }
  const campo = (k, label, props = {}) => (
    <label className="block text-sm font-semibold">{label}
      <input className="campo mt-1 font-normal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </label>
  )

  return (
    <form onSubmit={guardar} noValidate className="etiqueta space-y-4 p-4">
      {conv.cerrada && <Aviso tono="info" titulo="Edición cerrada: los datos quedan como se cerraron. Las correcciones van por propuesta de ajuste." />}
      <Resultado res={res} onActualizar={traerNuevos} />
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
        {campo('nombre', 'Nombre de la edición')}
        {campo('jornadas', 'Jornadas')}
        {campo('apertura', 'Abre (inclusive)', { type: 'date' })}
        {campo('cierre', 'Cierra (inclusive, hora de Argentina)', { type: 'date' })}
        <div>
          {campo('cupo', 'Cupo de mesas', { type: 'number', min: minimo, step: 1, inputMode: 'numeric' })}
          <p className="mt-1 text-xs text-tinta-suave">Hay {m.asignadas.length} asignadas; no se puede bajar de {minimo}.</p>
        </div>
        <div>
          {campo('valorMesa', 'Valor informativo de la mesa (ARS, dos jornadas)', { type: 'number', min: 0, step: 1000, inputMode: 'numeric' })}
          <p className="mt-1 text-xs text-tinta-suave">Vigente: {formatoPesos(conv.valorMesa)}. Las mesas ya aprobadas conservan el valor con que se aprobaron.</p>
        </div>
      </fieldset>
      {editable && <button className="btn btn-primario" type="submit">Guardar cambios</button>}
    </form>
  )
}

function Requisitos({ state, conv, perfil }) {
  const [editando, setEditando] = useState(null)
  const editable = perfil.rol === 'organizacion' && !conv.cerrada
  return (
    <div className="etiqueta space-y-3 p-4">
      <h2 className="text-2xl font-semibold">Requisitos · versión {conv.requisitosVersion}</h2>
      <ul className="divide-y divide-papel-oscuro">
        {conv.requisitos.map((r) => (
          <li key={r.id} className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p><strong>{r.texto}</strong> <span className="text-xs text-tinta-suave">({r.tipo === 'auto' ? 'automático' : 'manual'} · v{r.version})</span></p>
              {editable && editando !== r.id && <button className="btn btn-secundario" onClick={() => setEditando(r.id)}>Modificar</button>}
            </div>
            {editando === r.id && <EditarRequisito key={conv.rev} state={state} conv={conv} req={r} perfil={perfil} onListo={() => setEditando(null)} />}
          </li>
        ))}
      </ul>
      {conv.historialRequisitos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold">Historial de cambios</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {[...conv.historialRequisitos].reverse().map((h) => (
              <li key={h.version}>v{h.version} · {formatoInstante(h.instante)} · «{h.antes.texto}» → «{h.despues.texto}» · {h.pideRevision ? 'pidió revisión' : 'sin revisión'} · {h.motivo}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function EditarRequisito({ state, conv, req, perfil, onListo }) {
  const [texto, setTexto] = useState(req.texto)
  const [param, setParam] = useState(req.param ?? {})
  const [pideRevision, setPideRevision] = useState(true)
  const [motivo, setMotivo] = useState('')
  const [run, res] = useOperacion()
  const afectadas = state.entities.postulaciones.filter((p) => p.convocatoriaId === conv.id && ['en_revision', 'aprobada', 'lista_espera'].includes(p.estado)).length

  function guardar(e) {
    e.preventDefault()
    const datos = { convocatoriaId: conv.id, requisitoId: req.id, texto, pideRevision, motivo }
    if (req.param) datos.param = Object.fromEntries(Object.entries(param).map(([k, v]) => [k, Number(v)]))
    const r = run({ tipo: 'CONV_REQUISITO', actor: actorDe(state, perfil), revisionEsperada: conv.rev, datos }, (resp) => `Requisito actualizado a la versión ${resp.version}. ${resp.afectadas.length} postulación(es) quedaron «Para revisar».`)
    if (r.ok) setTimeout(onListo, 1500)
  }

  return (
    <form onSubmit={guardar} className="mt-2 space-y-2 rounded-md border-2 border-ocre bg-white p-3">
      <label className="block text-sm">Texto
        <input className="campo mt-1" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      {req.param && Object.keys(req.param).map((k) => (
        <label key={k} className="block text-sm">{k === 'max' ? 'Tope máximo' : 'Mínimo'}
          <input className="campo mt-1" type="number" value={param[k]} onChange={(e) => setParam({ ...param, [k]: e.target.value })} />
        </label>
      ))}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="h-5 w-5 accent-bordo" checked={pideRevision} onChange={(e) => setPideRevision(e.target.checked)} />
        Cambio obligatorio: marcar «Para revisar» las postulaciones ya revisadas de esta edición ({afectadas} en revisión, aprobadas o en espera)
      </label>
      <label className="block text-sm">Motivo del cambio
        <input className="campo mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: bajamos el tope de sulfitos" />
      </label>
      <Resultado res={res} />
      <div className="flex gap-2">
        <button className="btn btn-primario" type="submit">Guardar nueva versión</button>
        <button className="btn btn-secundario" type="button" onClick={onListo}>Cancelar</button>
      </div>
      <p className="text-xs text-tinta-suave">No se borran decisiones: las aprobadas conservan su mesa. Las otras ediciones no cambian.</p>
    </form>
  )
}
