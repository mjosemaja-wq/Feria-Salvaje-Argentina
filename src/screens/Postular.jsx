// Postulación en cuatro pasos. Pensada para completarse desde el celular.
import { useState } from 'react'
import { useDominio } from '../store.js'
import { postulacion, convocatoria, maxEtiquetas, minEtiquetas, requisito } from '../domain/selectors.js'
import { validarEnvio } from '../domain/engine.js'
import { E, ESTADOS_EDITABLES_PRODUCTOR, PROVINCIAS } from '../domain/constants.js'
import { dentroDePlazo, formatoFecha, clone, nuevoId } from '../domain/util.js'
import { useOperacion, Resultado, actorDe } from '../operacion.jsx'
import { Seccion, Aviso, EstadoChip, ir } from '../ui.jsx'

const PASOS = ['Bodega y viñedo', 'Etiquetas', 'Prácticas', 'Revisión y envío']

const borradorDe = (post) => ({ ficha: clone(post.ficha), etiquetas: clone(post.etiquetas), declaraciones: clone(post.declaraciones) })

export default function Postular({ perfil, postId }) {
  const state = useDominio()
  const post = postulacion(state, postId)
  // El productor solo abre su propia postulación.
  if (!post || post.bodegaId !== perfil.bodegaId) {
    return <Seccion titulo="Postulación"><Aviso tono="error" titulo="Esa postulación no es de tu bodega o no existe." /></Seccion>
  }
  return <Formulario key={post.id} state={state} post={post} perfil={perfil} />
}

function Formulario({ state, post, perfil }) {
  const conv = convocatoria(state, post.convocatoriaId)
  const actor = actorDe(state, perfil)
  const [paso, setPaso] = useState(0)
  const [draft, setDraft] = useState(() => borradorDe(post))
  const [revBase, setRevBase] = useState(post.rev)
  const [sucio, setSucio] = useState(false)
  const [run, res, setRes] = useOperacion()
  const editable = ESTADOS_EDITABLES_PRODUCTOR.includes(post.estado) && !conv.cerrada
  const plazo = dentroDePlazo(conv, Date.now())
  const esReenvio = post.estado === E.REQUIERE_CAMBIOS
  const fueraDePlazo = !esReenvio && !plazo.ok
  const pedido = [...post.comentarios].reverse().find((c) => c.tipo === 'cambios')

  const cambiar = (fn) => {
    setDraft((d) => {
      const n = clone(d)
      fn(n)
      return n
    })
    setSucio(true)
  }

  function guardar() {
    const r = run({ tipo: 'POST_GUARDAR', actor, revisionEsperada: revBase, datos: { postulacionId: post.id, ...draft } }, 'Guardado.')
    if (r.ok) {
      setRevBase(r.respuesta.rev ?? postulacion(r.state, post.id).rev)
      setSucio(false)
    }
    return r
  }
  function siguiente() {
    if (sucio && !guardar().ok) return
    setPaso((p) => Math.min(p + 1, 3))
    window.scrollTo({ top: 0 })
  }
  function enviar() {
    let rev = revBase
    if (sucio) {
      const g = guardar()
      if (!g.ok) return
      rev = g.respuesta.rev
    }
    const r = run({ tipo: 'POST_ENVIAR', actor, revisionEsperada: rev, datos: { postulacionId: post.id } }, esReenvio ? '¡Listo! Reenviaste tu postulación con los cambios.' : '¡Listo! Tu postulación quedó enviada.')
    if (r.ok) setTimeout(() => ir('mi-postulacion'), 900)
  }
  // Conflicto: otra pestaña cambió la postulación. Se puede traer lo nuevo o
  // conservar lo escrito y reintentar sobre la revisión vigente.
  function traerNuevos() {
    setDraft(borradorDe(post))
    setRevBase(post.rev)
    setSucio(false)
    setRes({ tono: 'info', t: 'Cargamos los datos vigentes. Revisalos antes de seguir.' })
  }
  function conservarMio() {
    setRevBase(post.rev)
    setRes({ tono: 'info', t: 'Mantuviste lo que escribiste sobre la versión vigente. Revisalo y guardá de nuevo.' })
  }

  const errores = validarEnvio({ ...post, ...draft }, conv)

  return (
    <Seccion titulo={esReenvio ? 'Corregí tu postulación' : 'Tu postulación'} bajada={`${conv.nombre} · ${draft.ficha.nombre}`} extra={<EstadoChip estado={post.estado} grande />}>
      {!editable && <Aviso tono="alerta" titulo={`Tu postulación está «${post.estado === E.ENVIADA ? 'Enviada' : 'en curso'}»: solo se edita en Borrador o cuando la organización te pide cambios.`} />}
      {esReenvio && pedido && <Aviso tono="alerta" titulo="Lo que te pidieron">«{pedido.texto}» — {pedido.autor}</Aviso>}
      {editable && fueraDePlazo && (
        <Aviso tono="error" titulo={plazo.motivo === 'cerro' ? `La convocatoria cerró el ${formatoFecha(conv.cierre)}. Ya no se aceptan envíos nuevos.` : `La convocatoria abre el ${formatoFecha(conv.apertura)}.`}>
          Podés seguir guardando el borrador, pero no enviarlo.
        </Aviso>
      )}
      {editable && !fueraDePlazo && !esReenvio && <p className="text-sm text-tinta-suave">La convocatoria cierra el {formatoFecha(conv.cierre)}.</p>}

      <ol className="grid grid-cols-4 gap-1" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <li key={p}>
            <button type="button" onClick={() => { if (!sucio || guardar().ok) setPaso(i) }} aria-current={paso === i ? 'step' : undefined} className={`w-full rounded border-2 px-1 py-2 text-left text-xs sm:text-sm ${paso === i ? 'border-bordo bg-bordo text-white' : 'border-papel-oscuro bg-white'}`}>
              <span className="tiza block text-lg leading-none">{i + 1}</span>
              <span className="sr-only sm:not-sr-only">{p}</span>
            </button>
          </li>
        ))}
      </ol>
      <h2 className="text-2xl font-semibold">{paso + 1}. {PASOS[paso]}</h2>

      {res?.code === 'REVISION_DESACTUALIZADA' && <Resultado res={res} />}
      {res?.code === 'REVISION_DESACTUALIZADA' && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secundario" onClick={traerNuevos}>Traer los datos nuevos</button>
          <button className="btn btn-secundario" onClick={conservarMio}>Conservar lo que escribí</button>
        </div>
      )}

      <fieldset disabled={!editable} className="etiqueta space-y-4 p-4 sm:p-6">
        {paso === 0 && <PasoBodega draft={draft} cambiar={cambiar} errores={errores} />}
        {paso === 1 && <PasoEtiquetas draft={draft} cambiar={cambiar} conv={conv} errores={errores} />}
        {paso === 2 && <PasoPracticas draft={draft} cambiar={cambiar} errores={errores} />}
        {paso === 3 && <PasoRevision draft={draft} conv={conv} errores={errores} />}
      </fieldset>

      {res && res.code !== 'REVISION_DESACTUALIZADA' && <Resultado res={res} />}
      <div className="flex flex-wrap gap-2">
        {paso > 0 && <button className="btn btn-secundario" onClick={() => setPaso(paso - 1)}>Volver</button>}
        {editable && sucio && <button className="btn btn-secundario" onClick={guardar}>Guardar borrador</button>}
        {paso < 3 && <button className="btn btn-primario" onClick={siguiente}>{editable ? 'Guardar y seguir' : 'Seguir'}</button>}
        {paso === 3 && editable && (
          <button className="btn btn-primario" onClick={enviar} disabled={fueraDePlazo}>{esReenvio ? 'Reenviar con los cambios' : 'Enviar postulación'}</button>
        )}
      </div>
    </Seccion>
  )
}

function Campo({ label, id, error, children, ayuda }) {
  return (
    <div>
      <label htmlFor={id} className="font-semibold">{label}</label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-tinta-suave">{ayuda}</p>}
      {error && <p className="mt-1 text-sm text-[#B3261E]">{error}</p>}
    </div>
  )
}
const errDe = (errores, campo) => errores.find((e) => e.campo === campo)?.mensaje

function PasoBodega({ draft, cambiar, errores }) {
  const f = draft.ficha
  const input = (k, props = {}) => (
    <input id={`f-${k}`} className="campo mt-1" value={f[k] ?? ''} aria-invalid={!!errDe(errores, `ficha.${k}`)} onChange={(e) => cambiar((d) => { d.ficha[k] = props.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })} {...props} />
  )
  const contacto = (k, props = {}) => (
    <input id={`c-${k}`} className="campo mt-1" value={f.contacto?.[k] ?? ''} aria-invalid={!!errDe(errores, `ficha.contacto.${k}`)} onChange={(e) => cambiar((d) => { d.ficha.contacto = { ...d.ficha.contacto, [k]: e.target.value } })} {...props} />
  )
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo label="Nombre de la bodega" id="f-nombre" error={errDe(errores, 'ficha.nombre')}>{input('nombre', { autoComplete: 'organization' })}</Campo>
      <Campo label="Provincia" id="f-provincia" error={errDe(errores, 'ficha.provincia')}>
        <select id="f-provincia" className="campo mt-1" value={f.provincia} onChange={(e) => cambiar((d) => { d.ficha.provincia = e.target.value })}>
          <option value="">Elegí</option>
          {PROVINCIAS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Campo>
      <Campo label="Localidad" id="f-localidad" error={errDe(errores, 'ficha.localidad')}>{input('localidad')}</Campo>
      <Campo label="Hectáreas de viñedo" id="f-hectareas" error={errDe(errores, 'ficha.hectareas')}>{input('hectareas', { type: 'number', inputMode: 'decimal', min: 0, step: 0.1 })}</Campo>
      <fieldset className="sm:col-span-2">
        <legend className="font-semibold">La uva es…</legend>
        <div className="mt-1 flex flex-wrap gap-4">
          {[['propia', 'Propia'], ['comprada', 'Comprada a un viñedo identificado']].map(([v, l]) => (
            <label key={v} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="uva" className="h-5 w-5 accent-bordo" checked={f.uva === v} onChange={() => cambiar((d) => { d.ficha.uva = v })} /> {l}
            </label>
          ))}
        </div>
        {errDe(errores, 'ficha.uva') && <p className="text-sm text-[#B3261E]">{errDe(errores, 'ficha.uva')}</p>}
      </fieldset>
      {f.uva === 'comprada' && <Campo label="Viñedo de origen" id="f-vinedo" error={errDe(errores, 'ficha.vinedo')} ayuda="Nombre del viñedo y del productor que te vende la uva.">{input('vinedo')}</Campo>}
      <Campo label="Botellas por año (toda la bodega)" id="f-botellasAnio" error={errDe(errores, 'ficha.botellasAnio')}>{input('botellasAnio', { type: 'number', inputMode: 'numeric', min: 0, step: 1 })}</Campo>
      <Campo label="Nombre de contacto" id="c-nombre" error={errDe(errores, 'ficha.contacto.nombre')}>{contacto('nombre', { autoComplete: 'name' })}</Campo>
      <Campo label="Correo de contacto" id="c-email" error={errDe(errores, 'ficha.contacto.email')}>{contacto('email', { type: 'email', autoComplete: 'email', inputMode: 'email' })}</Campo>
      <Campo label="Teléfono (opcional)" id="c-telefono">{contacto('telefono', { type: 'tel', autoComplete: 'tel', inputMode: 'tel' })}</Campo>
    </div>
  )
}

function PasoEtiquetas({ draft, cambiar, conv, errores }) {
  const max = maxEtiquetas(conv)
  const min = minEtiquetas(conv)
  const tope = requisito(conv, 'sulfitos')?.param?.max
  const n = draft.etiquetas.length
  return (
    <div className="space-y-4">
      <p className="text-sm text-tinta-suave">Presentá entre {min} y {max} etiquetas. Sulfitos totales de hasta {tope} mg/l por etiqueta.</p>
      {errDe(errores, 'etiquetas') && <Aviso tono="error" titulo={errDe(errores, 'etiquetas')} />}
      {draft.etiquetas.map((e, i) => {
        const alto = e.sulfitos !== '' && Number(e.sulfitos) > tope
        const set = (k, v) => cambiar((d) => { d.etiquetas[i][k] = v })
        return (
          <div key={e.id} className="rounded-md border-2 border-papel-oscuro bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-titulo text-xl font-semibold">Etiqueta {i + 1}</h3>
              <button type="button" className="rounded px-2 py-1 text-sm text-bordo underline" onClick={() => cambiar((d) => { d.etiquetas.splice(i, 1) })}>Quitar</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Campo label="Nombre" id={`e-${e.id}-n`} error={errDe(errores, `etiquetas.${e.id}.nombre`)}><input id={`e-${e.id}-n`} className="campo mt-1" value={e.nombre} onChange={(ev) => set('nombre', ev.target.value)} /></Campo>
              <Campo label="Cepa" id={`e-${e.id}-c`} error={errDe(errores, `etiquetas.${e.id}.cepa`)}><input id={`e-${e.id}-c`} className="campo mt-1" value={e.cepa} onChange={(ev) => set('cepa', ev.target.value)} /></Campo>
              <Campo label="Cosecha" id={`e-${e.id}-y`} error={errDe(errores, `etiquetas.${e.id}.cosecha`)} ayuda={e.cosecha ? null : 'Vacía solo si es un vino sin añada'}>
                <input id={`e-${e.id}-y`} className="campo mt-1" inputMode="numeric" maxLength={4} placeholder="2025" value={e.cosecha} onChange={(ev) => set('cosecha', ev.target.value.replace(/\D/g, ''))} />
              </Campo>
              <Campo label="Sulfitos (mg/l)" id={`e-${e.id}-s`} error={errDe(errores, `etiquetas.${e.id}.sulfitos`) || (alto ? `Pasa el tope de ${tope} mg/l: la organización lo va a marcar como no cumplido` : null)}>
                <input id={`e-${e.id}-s`} className="campo mt-1" type="number" inputMode="decimal" min={0} value={e.sulfitos} aria-invalid={alto} onChange={(ev) => set('sulfitos', ev.target.value === '' ? '' : Number(ev.target.value))} />
              </Campo>
            </div>
          </div>
        )
      })}
      <button type="button" className="btn btn-secundario" onClick={() => cambiar((d) => { d.etiquetas.push({ id: nuevoId('et'), nombre: '', cepa: '', cosecha: '', sulfitos: '' }) })} disabled={n >= 20}>
        + Agregar etiqueta {n >= max ? `(ya llegaste al máximo de ${max})` : ''}
      </button>
    </div>
  )
}

const DECLARACIONES = [
  ['uva', 'Trabajo con uva propia o de un viñedo identificado en la ficha.'],
  ['levaduras', 'Fermento con levaduras nativas, sin levaduras comerciales.'],
  ['correcciones', 'No corrijo acidez ni azúcar en ninguna de las etiquetas.'],
  ['veracidad', 'Los datos que cargué son reales y puedo mostrarlos si me los piden.'],
]

function PasoPracticas({ draft, cambiar, errores }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm text-tinta-suave">Todas las casillas son obligatorias para enviar.</legend>
      {DECLARACIONES.map(([k, txt]) => (
        <label key={k} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md border-2 p-3 ${draft.declaraciones[k] ? 'border-vina bg-[#EEF3EC]' : errDe(errores, `declaraciones.${k}`) ? 'border-ocre bg-white' : 'border-papel-oscuro bg-white'}`}>
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-vina" checked={draft.declaraciones[k]} onChange={(e) => cambiar((d) => { d.declaraciones[k] = e.target.checked })} />
          <span>{txt}</span>
        </label>
      ))}
    </fieldset>
  )
}

function PasoRevision({ draft, conv, errores }) {
  const f = draft.ficha
  return (
    <div className="space-y-4">
      {errores.length ? (
        <Aviso tono="alerta" titulo={errores.length === 1 ? 'Te falta una cosa para enviar' : `Te faltan ${errores.length} cosas para enviar`}>
          <ul className="mt-1 list-disc pl-5">{errores.map((e) => <li key={e.campo + e.mensaje}>{e.mensaje}</li>)}</ul>
        </Aviso>
      ) : (
        <Aviso tono="ok" titulo="Está todo para enviar" />
      )}
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-tinta-suave">Bodega</dt><dd className="font-semibold">{f.nombre} · {f.localidad}, {f.provincia}</dd></div>
        <div><dt className="text-tinta-suave">Viñedo</dt><dd className="font-semibold">{f.hectareas || '—'} ha · uva {f.uva || '—'}{f.vinedo ? ` (${f.vinedo})` : ''}</dd></div>
        <div><dt className="text-tinta-suave">Producción</dt><dd className="font-semibold">{f.botellasAnio ? Number(f.botellasAnio).toLocaleString('es-AR') : '—'} botellas/año</dd></div>
        <div><dt className="text-tinta-suave">Contacto</dt><dd className="font-semibold">{f.contacto?.nombre || '—'} · {f.contacto?.email || '—'}</dd></div>
      </dl>
      <ul className="space-y-1 text-sm">
        {draft.etiquetas.map((e) => <li key={e.id}>🍷 <strong>{e.nombre || 'Sin nombre'}</strong> · {e.cepa || 'sin cepa'} · {e.cosecha || 'sin cosecha'} · {e.sulfitos === '' ? 'sin sulfitos' : `${e.sulfitos} mg/l`}</li>)}
      </ul>
      <p className="text-xs text-tinta-suave">Valor de mesa informativo: se arregla por fuera de la app. {conv.jornadas}.</p>
    </div>
  )
}
