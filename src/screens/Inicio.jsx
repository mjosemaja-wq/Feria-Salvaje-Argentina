import { useState } from 'react'
import { ROLES, ACTORES } from '../domain/constants.js'
import { BODEGA_DEMO } from '../domain/seed.js'
import { guardarPerfil, useDominio } from '../store.js'
import { Aviso, ir } from '../ui.jsx'

const RUTA_INICIAL = { productor: 'mi-postulacion', organizacion: 'mesas', revisor: 'propuestas', auditor: 'conciliacion' }

export default function Inicio() {
  const state = useDominio()
  const bodegas = [...state.entities.bodegas].sort((a, b) => (a.id === BODEGA_DEMO ? -1 : b.id === BODEGA_DEMO ? 1 : a.nombre.localeCompare(b.nombre, 'es')))
  const [rol, setRol] = useState('productor')
  const [bodegaId, setBodegaId] = useState(BODEGA_DEMO)
  const [actorId, setActorId] = useState({ organizacion: ACTORES.organizacion[0].id, revisor: ACTORES.revisor[0].id, auditor: ACTORES.auditor[0].id })

  function entrar(e) {
    e.preventDefault()
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
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} · {b.localidad}, {b.provincia}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-sm text-tinta-suave">La primera es la bodega familiar de Lavalle del escenario: tiene un pedido de cambios esperando.</span>
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

        <button type="submit" className="btn btn-primario w-full sm:w-auto">Entrar</button>
      </form>
    </div>
  )
}
