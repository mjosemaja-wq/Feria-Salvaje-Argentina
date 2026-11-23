import { useState } from 'react'
import { ROLES, ACTORES, PROVINCIAS, actorProductor } from '../domain/constants.js'
import { BODEGA_DEMO } from '../domain/seed.js'
import { nuevoId } from '../domain/util.js'
import { guardarPerfil, useDominio, despachar } from '../store.js'
import { Aviso, ir } from '../ui.jsx'

const RUTA_INICIAL = { productor: 'mi-postulacion', organizacion: 'bandeja', revisor: 'propuestas', auditor: 'conciliacion' }
const NUEVA = '__nueva__'

export default function Inicio() {
  const state = useDominio()
  const bodegas = [...state.entities.bodegas].sort((a, b) => (a.id === BODEGA_DEMO ? -1 : b.id === BODEGA_DEMO ? 1 : a.nombre.localeCompare(b.nombre, 'es')))
  const [rol, setRol] = useState('productor')
  const [bodegaId, setBodegaId] = useState(BODEGA_DEMO)
  const [actorId, setActorId] = useState({ organizacion: ACTORES.organizacion[0].id, revisor: ACTORES.revisor[0].id, auditor: ACTORES.auditor[0].id })

  const [nueva, setNueva] = useState({ nombre: '', provincia: 'Mendoza', localidad: '' })
  const [error, setError] = useState(null)

  function entrar(e) {
    e.preventDefault()
    if (rol === 'productor' && bodegaId === NUEVA) {
      // Bodega nueva: se crea junto con su borrador en la edición abierta.
      const conv = state.entities.convocatorias.find((c) => !c.cerrada)
      if (!conv) return setError('No hay ninguna edición abierta para postularse.')
      const id = nuevoId('bod')
      const postId = nuevoId('pos')
      const r = despachar({ id: nuevoId('cmd'), tipo: 'POST_CREAR', actor: actorProductor({ id, nombre: nueva.nombre }), datos: { postulacionId: postId, convocatoriaId: conv.id, bodega: { id, ...nueva } } })
      if (!r.ok) return setError(r.error.message)
      guardarPerfil({ rol, bodegaId: id })
      return ir(`postular/${postId}`)
    }
    const perfil = rol === 'productor' ? { rol, bodegaId } : { rol, actorId: actorId[rol] }
    guardarPerfil(perfil)
    ir(RUTA_INICIAL[rol])
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 text-center">
        <p className="tiza text-sm uppercase tracking-[0.3em] text-vina">Convocatoria abierta</p>
        <h1 className="mt-2 text-5xl font-extrabold text-bordo sm:text-6xl">Feria Salvaje</h1>
        <p className="mt-2 font-titulo text-xl italic text-tinta-suave">vinos naturales · bodegas chicas · Palermo</p>
      </header>

      <div className="mb-6">
        <Aviso tono="alerta" titulo="Esto no es un inicio de sesión">
          Elegís un perfil de demo y queda guardado solo en este navegador. No hay cuentas ni contraseñas, y los permisos
          son de demostración: no protegen datos reales. Todos los datos son de ejemplo.
        </Aviso>
      </div>

      <form onSubmit={entrar} className="etiqueta space-y-5 p-5 sm:p-7">
        <fieldset>
          <legend className="font-titulo text-2xl font-semibold">¿Con qué perfil entrás?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.values(ROLES).map((r) => (
              <label key={r.id} className={`flex cursor-pointer gap-3 rounded-md border-2 p-3 ${rol === r.id ? 'border-bordo bg-[#F7E9EC]' : 'border-papel-oscuro bg-white'}`}>
                <input type="radio" name="rol" value={r.id} checked={rol === r.id} onChange={() => setRol(r.id)} className="mt-1 h-5 w-5 accent-bordo" />
                <span>
                  <span className="block font-semibold">{r.label}</span>
                  <span className="block text-sm text-tinta-suave">{r.descripcion}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {rol === 'productor' ? (
          <label className="block">
            <span className="font-semibold">Tu bodega</span>
            <select className="campo mt-1" value={bodegaId} onChange={(e) => setBodegaId(e.target.value)}>
              <option value={NUEVA}>➕ Soy una bodega nueva</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} · {b.localidad}, {b.provincia}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-sm text-tinta-suave">La Tranquera Nativa es la bodega familiar de Lavalle del escenario: tiene un pedido de cambios esperando.</span>
            {bodegaId === NUEVA && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-sm">Nombre de la bodega
                  <input className="campo mt-1" required value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
                </label>
                <label className="text-sm">Provincia
                  <select className="campo mt-1" value={nueva.provincia} onChange={(e) => setNueva({ ...nueva, provincia: e.target.value })}>
                    {PROVINCIAS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <label className="text-sm">Localidad
                  <input className="campo mt-1" value={nueva.localidad} onChange={(e) => setNueva({ ...nueva, localidad: e.target.value })} />
                </label>
              </div>
            )}
          </label>
        ) : (
          <label className="block">
            <span className="font-semibold">Persona de prueba</span>
            <select className="campo mt-1" value={actorId[rol]} onChange={(e) => setActorId({ ...actorId, [rol]: e.target.value })}>
              {ACTORES[rol].map((a) => (
                <option key={a.id} value={a.id}>{a.nombre}</option>
              ))}
            </select>
            {rol === 'revisor' && <span className="mt-1 block text-sm text-tinta-suave">Hay dos personas de revisión para probar que nadie aprueba lo que propuso.</span>}
          </label>
        )}

        {error && <Aviso tono="error" titulo={error} />}
        <button type="submit" className="btn btn-primario w-full sm:w-auto">Entrar</button>
      </form>
    </div>
  )
}
